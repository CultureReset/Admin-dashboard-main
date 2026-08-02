/**
 * Root component. Decides between the login screen and the dashboard shell,
 * and never renders the shell until the server has confirmed the session.
 */

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import { ToastProvider } from './ui/Toast.jsx';
import { LoginPage } from './auth/LoginPage.jsx';
import { AppShell } from './shell/AppShell.jsx';
import { LoadingBlock } from './ui/primitives.jsx';
import { EntityProvider } from './components/EntityPicker.jsx';
import { useTheme } from './shell/useTheme.js';

function Gate() {
  const { isAuthenticated, isChecking } = useAuth();
  // Apply the persisted theme on both the login screen and the shell.
  useTheme();

  if (isChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingBlock label="Checking your session…" />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  // The entity list is fetched once here and shared by every section that
  // needs to scope its work to a business.
  return (
    <EntityProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </EntityProvider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
