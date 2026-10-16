/**
 * OAuth sign-in (Supabase Auth: Google / GitHub) through gcr-api-clean.
 *
 *   1. startOAuth(): make a PKCE verifier, keep it in sessionStorage, and send
 *      the browser to GET {api}/api/oauth/authorize, which 302s to Supabase,
 *      which 302s to Google/GitHub.
 *   2. The provider comes back to {this origin}/auth/callback?code=...
 *   3. completeOAuthFromUrl(): POST {api}/api/oauth/exchange with the code and
 *      the verifier; the API returns a Supabase session.
 *
 * No Supabase URL or key is in this bundle; the API owns that.
 */

import { config, apiUrl } from '../config/env.js';
import { api } from '../api/client.js';

const VERIFIER_KEY = 'cc_oauth_pkce_verifier';
export const CALLBACK_PATH = '/auth/callback';

function base64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export async function startOAuth(provider) {
  const { verifier, challenge } = await pkcePair();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const redirectTo = `${window.location.origin}${CALLBACK_PATH}`;
  const qs = new URLSearchParams({ provider, redirect_to: redirectTo, code_challenge: challenge });
  window.location.assign(apiUrl(`/api/oauth/authorize?${qs}`));
}

export function isOAuthCallback() {
  return window.location.pathname === CALLBACK_PATH;
}

/** Returns the Supabase session, or throws with a readable message. */
export async function completeOAuthFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const providerError = params.get('error_description') || hash.get('error_description');
  const code = params.get('code');
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  window.history.replaceState({}, '', '/');
  if (providerError) throw new Error(providerError);
  if (!code || !verifier) throw new Error('That sign-in link is incomplete or was already used. Try again.');
  const out = await api.post('/api/oauth/exchange', { auth_code: code, code_verifier: verifier }, { auth: false });
  if (!out?.session?.access_token) throw new Error('The server did not return a session.');
  return out.session;
}

/** Renew a Supabase session with its refresh token. */
export async function refreshOAuthSession(refreshToken) {
  const out = await api.post('/api/business-auth/refresh', { refresh_token: refreshToken }, { auth: false });
  return out?.session || null;
}

export const oauthProviders = String(config.oauthProviders || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
