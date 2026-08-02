/**
 * Modal dialog + confirmation helper.
 *
 * Closes on Escape and on backdrop click, restores focus, and locks body
 * scroll while open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './primitives.jsx';
import './Modal.css';

export function Modal({ open, onClose, title, description, footer, size = 'md', children }) {
  const previouslyFocused = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    // Move focus into the dialog so keyboard users land in the right place.
    const timer = setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="ui-modal" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <div
        ref={panelRef}
        className={`ui-modal__panel ui-modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        <header className="ui-modal__head">
          <div>
            {title && <h2 className="ui-modal__title">{title}</h2>}
            {description && <p className="ui-modal__desc">{description}</p>}
          </div>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Imperative confirm. Returns [confirm, element] — call `confirm(options)`
 * and await the boolean.
 *
 * Used for every destructive action so a stray click never deletes a record.
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((options = {}) => {
    setState({
      title: options.title || 'Are you sure?',
      message: options.message || 'This cannot be undone.',
      confirmLabel: options.confirmLabel || 'Delete',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'danger',
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
    setBusy(false);
  }, []);

  const element = state ? (
    <Modal
      open
      size="sm"
      title={state.title}
      onClose={() => settle(false)}
      footer={
        <>
          <div className="spacer" />
          <Button variant="ghost" onClick={() => settle(false)} disabled={busy}>
            {state.cancelLabel}
          </Button>
          <Button
            variant={state.tone}
            loading={busy}
            onClick={() => {
              setBusy(true);
              settle(true);
            }}
          >
            {state.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="muted">{state.message}</p>
    </Modal>
  ) : null;

  return [confirm, element];
}

export default Modal;
