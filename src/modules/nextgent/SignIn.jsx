import { useState } from 'react';
import { authApi } from '../../api/paperclip.js';
import { Button } from '../../ui/primitives.jsx';
import '../../auth/LoginPage.css';

export default function PaperclipSignIn({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="login__card"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          await authApi.signIn(email.trim(), password);
          onDone();
        } catch (err) {
          setError(err.message || 'Sign in failed');
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="login__sub">This section uses the Paperclip sign-in. The rest of the dashboard does not.</p>
      {error ? (
        <div className="login__error" role="alert">
          {error}
        </div>
      ) : null}
      <label className="login__field">
        <span>Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
      </label>
      <label className="login__field">
        <span>Password</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </label>
      <Button type="submit" variant="primary" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
