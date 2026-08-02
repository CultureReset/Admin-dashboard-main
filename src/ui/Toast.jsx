/**
 * Toast notifications.
 *
 * Every write in the dashboard reports its outcome here, so a save that
 * silently failed is not possible — success and failure both surface.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = ++nextId;
      const entry = {
        id,
        tone: toast.tone || 'info',
        title: toast.title || '',
        message: toast.message || '',
        duration: toast.duration ?? (toast.tone === 'danger' ? 8000 : 4000),
      };
      setToasts((prev) => [...prev, entry]);
      if (entry.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), entry.duration));
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, title) => push({ tone: 'success', message, title: title || 'Saved' }),
      info: (message, title) => push({ tone: 'info', message, title }),
      warning: (message, title) => push({ tone: 'warning', message, title: title || 'Heads up' }),
      /** Accepts an ApiError or a string. */
      error: (errorOrMessage, title) => {
        const message =
          typeof errorOrMessage === 'string'
            ? errorOrMessage
            : errorOrMessage?.message || 'Something went wrong';
        const path = typeof errorOrMessage === 'object' ? errorOrMessage?.path : null;
        return push({
          tone: 'danger',
          title: title || 'Failed',
          message: path ? `${message} (${path})` : message,
        });
      },
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>
            <div className="ui-toast__body">
              {toast.title && <div className="ui-toast__title">{toast.title}</div>}
              {toast.message && <div className="ui-toast__msg">{toast.message}</div>}
            </div>
            <button
              type="button"
              className="ui-toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export default ToastProvider;
