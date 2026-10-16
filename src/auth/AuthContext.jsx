/**
 * Authentication state.
 *
 * The legacy dashboard's guard is reproduced deliberately: a decoded-but-
 * unverified JWT payload can be forged client-side, so the dashboard stays
 * hidden until an authenticated request to the API succeeds. The decode is
 * only used for fast-fail (expired token, wrong role) and for display.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, onAuthFailure } from '../api/client.js';
import { endpoints } from '../api/endpoints.js';
import { config } from '../config/env.js';
import { tokenStore, decodeToken, isTokenExpired } from './tokenStore.js';
import { isOAuthCallback, completeOAuthFromUrl, refreshOAuthSession } from './oauth.js';

/** Supabase Auth tokens carry role 'authenticated'; the API decides admin-ness. */
const isSupabaseToken = (claims) => /\/auth\/v1$/.test(String(claims?.iss || ''));

const AuthContext = createContext(null);

/** 'checking' → verifying a stored token. 'authenticated' → server confirmed. */
const STATUS = {
  CHECKING: 'checking',
  ANONYMOUS: 'anonymous',
  AUTHENTICATED: 'authenticated',
};

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(STATUS.CHECKING);
  const [user, setUser] = useState(() => tokenStore.getUser());
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const signOut = useCallback((reason) => {
    tokenStore.clear();
    if (!mounted.current) return;
    setUser(null);
    setStatus(STATUS.ANONYMOUS);
    setError(reason || null);
  }, []);

  /**
   * Confirm a token with the API. Returns true only when the server accepts
   * it — a 401/403 clears the session, a network error leaves it alone so a
   * flaky connection doesn't log the user out.
   */
  const verifyToken = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setStatus(STATUS.ANONYMOUS);
      return false;
    }

    if (isTokenExpired(token)) {
      // OAuth sessions are short-lived (1h); renew instead of logging out.
      const renewed = tokenStore.getRefresh() && await renewSession().catch(() => false);
      if (!renewed) {
        signOut('Your session expired. Please sign in again.');
        return false;
      }
    }

    const claims = decodeToken(tokenStore.get());
    if (claims?.role && !isSupabaseToken(claims) && claims.role !== config.requiredRole) {
      signOut(`This account does not have ${config.requiredRole} access.`);
      return false;
    }

    try {
      await api.get(endpoints.auth.verify());
      if (!mounted.current) return true;
      setUser((current) => current || tokenStore.getUser() || claimsToUser(claims));
      setStatus(STATUS.AUTHENTICATED);
      setError(null);
      return true;
    } catch (err) {
      if (!mounted.current) return false;
      if (err.isAuthError) {
        signOut('Your session is no longer valid. Please sign in again.');
        return false;
      }
      // Network/server trouble: keep the session, let the UI report it.
      setStatus(STATUS.AUTHENTICATED);
      setError(err.message);
      return true;
    }
  }, [signOut]);

  // Page load: finish an OAuth redirect if we are on /auth/callback, then
  // confirm the session with the API before anything renders.
  useEffect(() => {
    (async () => {
      if (isOAuthCallback()) {
        try {
          adoptSupabaseSession(await completeOAuthFromUrl());
        } catch (err) {
          tokenStore.clear();
          setStatus(STATUS.ANONYMOUS);
          setError(err.message);
          return;
        }
      }
      const ok = await verifyToken();
      // An OAuth account that is not a platform admin gets 403 from the API.
      if (!ok) return;
    })();
  }, [verifyToken]);

  // Keep an OAuth session alive: renew ~1 minute before the access token expires.
  useEffect(() => {
    if (status !== STATUS.AUTHENTICATED || !tokenStore.getRefresh()) return undefined;
    const exp = decodeToken(tokenStore.get())?.exp;
    if (!exp) return undefined;
    const wait = Math.max(5000, exp * 1000 - Date.now() - 60000);
    const t = setTimeout(() => {
      renewSession().catch(() => signOut('Your session expired. Please sign in again.'));
    }, wait);
    return () => clearTimeout(t);
  }, [status, user, signOut]);

  // A 401 from any request anywhere ends the session; a 403 on an OAuth
  // session means the account is signed in but is not a platform admin.
  useEffect(() => onAuthFailure((err) => {
    if (err.status === 401) signOut('Your session is no longer valid. Please sign in again.');
    if (err.status === 403 && isSupabaseToken(decodeToken(tokenStore.get()))) {
      signOut('This Google/GitHub account does not have admin access.');
    }
  }), [signOut]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const payload = await api.post(
      endpoints.auth.login(),
      { email, password },
      { auth: false },
    );

    const token = payload?.token;
    if (!token) {
      throw new Error('The server did not return a session token.');
    }

    const claims = decodeToken(token);
    const profile = payload.admin || claimsToUser(claims);

    if (profile?.role && profile.role !== config.requiredRole) {
      throw new Error(`This account does not have ${config.requiredRole} access.`);
    }

    tokenStore.set(token);
    tokenStore.setUser(profile);
    if (mounted.current) {
      setUser(profile);
      setStatus(STATUS.AUTHENTICATED);
    }
    return profile;
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      error,
      isAuthenticated: status === STATUS.AUTHENTICATED,
      isChecking: status === STATUS.CHECKING,
      signIn,
      signOut,
      clearError: () => setError(null),
    }),
    [status, user, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Store a Supabase session (OAuth) as the admin session. */
function adoptSupabaseSession(session) {
  tokenStore.set(session.access_token);
  tokenStore.setRefresh(session.refresh_token);
  tokenStore.setUser({ id: session.user?.id, email: session.user?.email, role: 'admin', provider: session.user?.provider });
}

async function renewSession() {
  const next = await refreshOAuthSession(tokenStore.getRefresh());
  if (!next?.access_token) throw new Error('renew failed');
  adoptSupabaseSession(next);
  return true;
}

function claimsToUser(claims) {
  if (!claims) return null;
  return {
    id: claims.id ?? claims.userId ?? null,
    email: claims.email ?? null,
    role: claims.role ?? null,
  };
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { STATUS as AUTH_STATUS };
