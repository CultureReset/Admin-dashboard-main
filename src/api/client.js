/**
 * HTTP client.
 *
 * One place that knows how to talk to the API: base URL, auth header, JSON
 * encoding, query strings, timeouts, and error normalization. Section modules
 * never call fetch directly.
 */

import { config, apiUrl } from '../config/env.js';
import { tokenStore } from '../auth/tokenStore.js';

/** Raised for any non-2xx response, carrying enough context to render well. */
export class ApiError extends Error {
  constructor(message, { status = 0, path = '', body = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.body = body;
    this.cause = cause;
  }

  /** 404 on a path the API has never implemented (see endpoints.unverified). */
  get isMissingEndpoint() {
    return this.status === 404 || this.status === 405;
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

/** Listeners notified when the API rejects our token, so the app can log out. */
const authFailureListeners = new Set();

export function onAuthFailure(listener) {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

function notifyAuthFailure(error) {
  for (const listener of authFailureListeners) {
    try {
      listener(error);
    } catch {
      // A misbehaving listener must not break the request path.
    }
  }
}

/**
 * Serialize a query object. Undefined/null/'' are dropped so callers can pass
 * optional filters straight through without pruning them first.
 */
export function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined && entry !== null && entry !== '') {
          search.append(key, String(entry));
        }
      }
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return null;
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function messageFrom(body, response, path) {
  if (body && typeof body === 'object') {
    const candidate = body.error || body.message || body.detail;
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
    return body.trim().slice(0, 300);
  }
  if (response.status === 404) return `Endpoint not found: ${path}`;
  return `Request failed (${response.status} ${response.statusText || ''})`.trim();
}

/**
 * Core request. Returns the parsed body on success and throws ApiError
 * otherwise.
 *
 * @param {string} path      Path from the endpoint registry.
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {object} [options.body]      JSON-encoded automatically.
 * @param {FormData} [options.formData] Sent as-is (file uploads).
 * @param {object} [options.query]     Appended as a query string.
 * @param {boolean} [options.auth=true] Attach the bearer token.
 * @param {AbortSignal} [options.signal]
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    formData,
    query,
    auth = true,
    signal,
    headers: extraHeaders,
    timeoutMs = config.requestTimeoutMs,
  } = options;

  const fullPath = `${path}${buildQuery(query)}`;
  const url = apiUrl(fullPath);

  const headers = { Accept: 'application/json', ...extraHeaders };

  if (auth) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (formData) {
    payload = formData; // Browser sets the multipart boundary itself.
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  // Combine the caller's abort signal with our timeout.
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
    // A caller-initiated abort is not an error worth wrapping.
    if (signal?.aborted) throw err;
    const aborted = err?.name === 'AbortError';
    throw new ApiError(
      aborted ? `Request timed out after ${timeoutMs}ms` : 'Network error — could not reach the API',
      { status: 0, path: fullPath, cause: err },
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }

  const parsed = await parseBody(response);

  // A 2xx HTML body means this request never reached the API — some host
  // answered with an SPA shell instead. The usual cause is an unset
  // VITE_API_BASE_URL: `apiUrl()` then returns a bare path, the browser
  // resolves it against the dashboard's own origin, and the SPA rewrite in
  // vercel.json serves index.html with a 200.
  //
  // Left alone this is invisible rather than loud. `response.ok` is true, so
  // nothing throws; parseBody hands back the HTML as a string; unwrapList sees
  // a non-array non-object and returns []. Every list screen renders empty,
  // with no error and no toast — which reads as "the data is gone" rather than
  // "the dashboard is pointed at itself".
  if (response.ok && typeof parsed === 'string' && /^\s*<(?:!doctype|html)\b/i.test(parsed)) {
    throw new ApiError(
      config.apiBaseUrl
        ? `Expected JSON from ${config.apiBaseUrl} but got an HTML page. That base URL is serving a website, not the API.`
        : 'Expected JSON but got an HTML page. VITE_API_BASE_URL is not set, so this request went to the dashboard’s own origin instead of the API.',
      { status: response.status, path: fullPath, body: parsed },
    );
  }

  if (!response.ok) {
    const error = new ApiError(messageFrom(parsed, response, fullPath), {
      status: response.status,
      path: fullPath,
      body: parsed,
    });
    if (error.isAuthError && auth) notifyAuthFailure(error);
    throw error;
  }

  return parsed;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) => request(path, { ...options, method: 'POST', formData }),
};

/**
 * Pull a list out of a response without every caller repeating the same
 * guesswork. The API is not uniform — some routes return `{entities: []}`,
 * some `{rails: []}`, some a bare array — so callers name the keys they
 * expect and this walks them in order.
 */
export function unwrapList(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  // Fall back to the first array-valued property.
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** Same idea for single-object responses. */
export function unwrapItem(payload, keys = []) {
  if (!payload || typeof payload !== 'object') return payload ?? null;
  for (const key of keys) {
    if (payload[key] && typeof payload[key] === 'object') return payload[key];
  }
  return payload;
}

export default api;
