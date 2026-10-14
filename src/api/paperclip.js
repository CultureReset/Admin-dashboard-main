/**
 * Paperclip, from inside the existing admin dashboard.
 *
 * Calls go to `/api/paperclip/...` on this dashboard and are forwarded to the
 * Paperclip server. The Gulf Coast Radar client keeps using its own API.
 * Set PAPERCLIP_SERVER_URL on the deployment, and PAPERCLIP_DEV_SERVER for
 * local dev (defaults to http://localhost:3100).
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
    this.isAuthError = status === 401;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api/paperclip${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && typeof data === 'object' && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(String(message), res.status, data);
  }
  return data;
}

export const pc = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  patch: (path, body = {}) => request('PATCH', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

export const authApi = {
  session: async () => {
    try {
      return await pc.get('/auth/get-session');
    } catch (err) {
      if (err.status === 401) return null;
      throw err;
    }
  },
  signIn: (email, password) => pc.post('/auth/sign-in/email', { email, password }),
  signOut: () => pc.post('/auth/sign-out', {}),
};

export const adminApi = {
  businesses: () => pc.get('/companies'),
  users: (query = '') => pc.get(`/admin/users${query ? `?query=${encodeURIComponent(query)}` : ''}`),

  storeItems: () => pc.get('/store/admin/items'),
  createItem: (input) => pc.post('/store/admin/items', input),
  updateItem: (itemId, patch) => pc.patch(`/store/admin/items/${itemId}`, patch),
  release: (itemId, input) => pc.post(`/store/admin/items/${itemId}/versions`, input),
  publish: (itemId) => pc.post(`/store/admin/items/${itemId}/publish`, {}),
  unpublish: (itemId) => pc.post(`/store/admin/items/${itemId}/retire`, {}),

  menuSettings: () => pc.get('/store/admin/menu'),
  setCoreMenu: (core) => pc.put('/store/admin/menu', { core }),
};
