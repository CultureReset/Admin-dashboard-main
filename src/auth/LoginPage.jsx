/**
 * Sign-in screen. Posts to POST /api/admin/login and stores the returned JWT.
 */

import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { config } from '../config/env.js';
import { Button } from '../ui/primitives.jsx';
import './LoginPage.css';

export function LoginPage() {
  const { signIn, error: sessionError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    clearError();
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const apiTarget = config.apiBaseUrl || `${window.location.origin} (same origin)`;

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__brand">
          <span className="login__logo" aria-hidden="true">◈</span>
          <h1 className="login__title">{config.appName}</h1>
          <p className="login__sub">Sign in to manage the platform.</p>
        </div>

        {(error || sessionError) && (
          <div className="login__error" role="alert">
            {error || sessionError}
          </div>
        )}

        <label className="login__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="login__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <Button type="submit" variant="primary" size="lg" loading={busy} className="login__submit">
          Sign in
        </Button>

        <p className="login__api mono" title="Configured with VITE_API_BASE_URL">
          {apiTarget}
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
