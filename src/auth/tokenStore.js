/**
 * Token persistence.
 *
 * Isolated from AuthContext so the API client can read the token without
 * importing React, and so the storage key stays configurable (src/config/env.js).
 */

import { config } from '../config/env.js';

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private-mode Safari and some embedded webviews throw on access.
    return null;
  }
}

/** In-memory fallback so the session still works when storage is unavailable. */
let memoryToken = null;
let memoryUser = null;

export const tokenStore = {
  get() {
    const storage = safeStorage();
    if (!storage) return memoryToken;
    return storage.getItem(config.authTokenKey) || null;
  },

  set(token) {
    memoryToken = token;
    const storage = safeStorage();
    if (!storage) return;
    if (token) storage.setItem(config.authTokenKey, token);
    else storage.removeItem(config.authTokenKey);
  },

  getUser() {
    const storage = safeStorage();
    if (!storage) return memoryUser;
    const raw = storage.getItem(config.authUserKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setUser(user) {
    memoryUser = user;
    const storage = safeStorage();
    if (!storage) return;
    if (user) storage.setItem(config.authUserKey, JSON.stringify(user));
    else storage.removeItem(config.authUserKey);
  },

  clear() {
    memoryToken = null;
    memoryUser = null;
    const storage = safeStorage();
    if (!storage) return;
    storage.removeItem(config.authTokenKey);
    storage.removeItem(config.authUserKey);
  },
};

/**
 * Decode a JWT payload without verifying it.
 *
 * This is only ever used for UI hints (showing the signed-in email, an early
 * "your session expired" message). Authorization is decided by the server —
 * see AuthContext, which confirms every session with an authenticated request
 * before rendering the dashboard.
 */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** True when the token carries an `exp` claim that has already passed. */
export function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}

export default tokenStore;
