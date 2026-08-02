/**
 * UI primitives.
 *
 * Small, unopinionated building blocks used by every section. They carry no
 * business knowledge and no colour literals — everything routes through the
 * design tokens in src/styles/theme.css.
 */

import { forwardRef } from 'react';
import './primitives.css';

/* -------------------------------------------------------------- Button -- */

export const Button = forwardRef(function Button(
  { variant = 'default', size = 'md', loading = false, icon, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="ui-btn__spinner" aria-hidden="true" /> : icon}
      {children != null && <span>{children}</span>}
    </button>
  );
});

/* ---------------------------------------------------------------- Card -- */

export function Card({ title, subtitle, actions, footer, padded = true, className = '', children }) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || actions || subtitle) && (
        <header className="ui-card__head">
          <div className="ui-card__titles">
            {title && <h2 className="ui-card__title">{title}</h2>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-card__actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'ui-card__body' : 'ui-card__body ui-card__body--flush'}>{children}</div>
      {footer && <footer className="ui-card__foot">{footer}</footer>}
    </section>
  );
}

/* --------------------------------------------------------------- Badge -- */

export function Badge({ tone = 'neutral', children }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

/* --------------------------------------------------------------- Stat --- */

export function Stat({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`ui-stat ui-stat--${tone}`}>
      <div className="ui-stat__value">{value}</div>
      <div className="ui-stat__label">{label}</div>
      {hint && <div className="ui-stat__hint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Spinner -- */

export function Spinner({ size = 18, label }) {
  return (
    <span className="ui-spinner-wrap">
      <span className="ui-spinner" style={{ width: size, height: size }} aria-hidden="true" />
      {label && <span className="muted">{label}</span>}
    </span>
  );
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="ui-loading-block">
      <Spinner label={label} />
    </div>
  );
}

/* ---------------------------------------------------------- EmptyState -- */

export function EmptyState({ icon = '∅', title = 'Nothing here yet', description, action }) {
  return (
    <div className="ui-empty">
      <div className="ui-empty__icon" aria-hidden="true">{icon}</div>
      <div className="ui-empty__title">{title}</div>
      {description && <p className="ui-empty__desc">{description}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------- ErrorState -- */

/**
 * Renders an ApiError honestly. A 404 on a path the API never implemented
 * says so explicitly rather than showing a generic failure, because those
 * two situations need different fixes.
 */
export function ErrorState({ error, onRetry, context }) {
  if (!error) return null;
  const missing = error.isMissingEndpoint;
  const network = error.isNetworkError;

  return (
    <div className={`ui-error ui-error--${missing ? 'warning' : 'danger'}`}>
      <div className="ui-error__title">
        {missing ? 'This endpoint is not available on the API' : network ? 'Could not reach the API' : 'Something went wrong'}
      </div>
      <p className="ui-error__msg">{error.message}</p>
      {error.path && <p className="ui-error__path mono">{error.path}</p>}
      {missing && (
        <p className="ui-error__hint">
          The dashboard is wired to this path, but <code>gcr-api-clean</code> does not serve it yet.
          Nothing was saved. See <code>docs/ENDPOINT-STATUS.md</code>.
        </p>
      )}
      {context && <p className="ui-error__hint">{context}</p>}
      {onRetry && (
        <div className="ui-error__action">
          <Button size="sm" onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- PageHeader --- */

export function PageHeader({ title, description, actions, breadcrumbs }) {
  return (
    <header className="ui-page-head">
      {breadcrumbs && <div className="ui-page-head__crumbs">{breadcrumbs}</div>}
      <div className="ui-page-head__main">
        <div>
          <h1 className="ui-page-head__title">{title}</h1>
          {description && <p className="ui-page-head__desc">{description}</p>}
        </div>
        {actions && <div className="ui-page-head__actions">{actions}</div>}
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- Notice -- */

export function Notice({ tone = 'info', title, children }) {
  return (
    <div className={`ui-notice ui-notice--${tone}`}>
      {title && <div className="ui-notice__title">{title}</div>}
      {children && <div className="ui-notice__body">{children}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- Toolbar ---- */

export function Toolbar({ children }) {
  return <div className="ui-toolbar">{children}</div>;
}

/* -------------------------------------------------------- SearchInput --- */

export function SearchInput({ value, onChange, placeholder = 'Search…', ...rest }) {
  return (
    <div className="ui-search">
      <span className="ui-search__icon" aria-hidden="true">⌕</span>
      <input
        className="ui-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
