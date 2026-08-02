/**
 * Theme toggle. Writes `data-theme` on the root element, which the token
 * sheet keys off. Persisted so the choice survives a reload.
 */

import { useEffect } from 'react';
import { usePersistentState } from '../hooks/useAsync.js';

export function useTheme() {
  const [theme, setTheme] = usePersistentState('cc_admin_theme', 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggle = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return [theme, toggle, setTheme];
}

export default useTheme;
