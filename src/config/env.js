/**
 * Runtime configuration.
 *
 * Every environment-specific value in the dashboard resolves through here.
 * No module is allowed to reference an API host, storage key, or role name
 * directly — they import from this file instead, so a deployment can be
 * repointed without touching source.
 *
 * Resolution order, highest priority first:
 *   1. window.__ADMIN_CONFIG__  — set by a static config.js at deploy time,
 *                                 or by hand in the console while debugging.
 *   2. import.meta.env.VITE_*   — baked in at build time from .env files.
 *   3. The fallback passed at the call site.
 */

const runtime = typeof window !== 'undefined' ? window.__ADMIN_CONFIG__ || {} : {};
const buildTime = import.meta.env || {};

function read(runtimeKey, envKey, fallback) {
  const fromRuntime = runtime[runtimeKey];
  if (fromRuntime !== undefined && fromRuntime !== null && fromRuntime !== '') {
    return fromRuntime;
  }
  const fromEnv = buildTime[envKey];
  if (fromEnv !== undefined && fromEnv !== null && fromEnv !== '') {
    return fromEnv;
  }
  return fallback;
}

function readNumber(runtimeKey, envKey, fallback) {
  const value = Number(read(runtimeKey, envKey, fallback));
  return Number.isFinite(value) ? value : fallback;
}

/** Strip a trailing slash so path concatenation never doubles up. */
function normalizeBase(value) {
  if (!value) return '';
  return String(value).replace(/\/+$/, '');
}

/**
 * Where the API lives when nothing says otherwise.
 *
 * This used to fall back to an empty string, meaning "same origin" — correct
 * only when the dashboard is served behind the same domain as the API, which
 * it is not. Deployed to its own Vercel domain without VITE_API_BASE_URL set,
 * every call went to the static site instead: `POST /api/admin/login` came
 * back 405 Method Not Allowed, because static hosting does not take a POST.
 * Signing in was impossible and the reason was two layers away from the
 * error message.
 *
 * The live API is a known value, so it belongs here rather than in a variable
 * somebody has to remember to set. Both overrides still win: set
 * VITE_API_BASE_URL to point somewhere else, or window.__ADMIN_CONFIG__ to
 * repoint a built bundle without rebuilding. Same default the business
 * dashboard carries in its own config.
 *
 * For same-origin deployments, set the override to '/' explicitly.
 */
const DEFAULT_API_BASE = 'https://gcr-api-clean.vercel.app';

export const config = {
  /**
   * Base URL for the gcr-api-clean API. A single '/' means "same origin",
   * which is what you want when the dashboard is served behind the same
   * domain as the API.
   */
  apiBaseUrl: normalizeBase(read('apiBaseUrl', 'VITE_API_BASE_URL', DEFAULT_API_BASE)),

  /** localStorage key for the admin JWT. */
  authTokenKey: read('authTokenKey', 'VITE_AUTH_TOKEN_KEY', 'cc_admin_token'),

  /** localStorage key for the cached admin profile. Derived from the token key. */
  get authUserKey() {
    return `${this.authTokenKey}_user`;
  },

  /** Role the JWT must carry for the dashboard to render. */
  requiredRole: read('requiredRole', 'VITE_REQUIRED_ROLE', 'admin'),

  /**
   * Public GCR site, used to build claim/preview links. Empty means "not
   * configured" and the screens that need it say so rather than guessing.
   */
  publicSiteUrl: normalizeBase(read('publicSiteUrl', 'VITE_PUBLIC_SITE_URL', '')),

  appName: read('appName', 'VITE_APP_NAME', 'CyberCheck Admin'),
  appShortName: read('appShortName', 'VITE_APP_SHORT_NAME', 'CyberCheck'),

  defaultPageSize: readNumber('defaultPageSize', 'VITE_DEFAULT_PAGE_SIZE', 50),
  requestTimeoutMs: readNumber('requestTimeoutMs', 'VITE_REQUEST_TIMEOUT_MS', 45000),

  /** True when the app was built for development. */
  isDev: Boolean(buildTime.DEV),
};

/**
 * Join the configured API base with a path. Used by the API client and by
 * anything that needs an absolute URL (e.g. opening an export in a new tab).
 */
export function apiUrl(path) {
  const suffix = String(path || '');
  const normalized = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `${config.apiBaseUrl}${normalized}`;
}

export default config;
