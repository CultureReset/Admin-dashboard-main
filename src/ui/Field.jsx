/**
 * Form controls.
 *
 * Every input the dashboard renders comes from here, selected by a field
 * descriptor's `type`. Adding a new control means registering it in
 * CONTROLS — sections never reach for a raw <input>.
 */

import { useId } from 'react';
import './Field.css';

function TextControl({ id, value, onChange, field, disabled }) {
  return (
    <input
      id={id}
      className="ui-input"
      type={field.inputType || 'text'}
      value={value ?? ''}
      placeholder={field.placeholder || ''}
      disabled={disabled}
      autoComplete={field.autoComplete}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberControl({ id, value, onChange, field, disabled }) {
  return (
    <input
      id={id}
      className="ui-input"
      type="number"
      value={value ?? ''}
      placeholder={field.placeholder || ''}
      min={field.min}
      max={field.max}
      step={field.step ?? 'any'}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;
        // Preserve empty as null so a cleared optional number isn't sent as 0.
        onChange(raw === '' ? null : Number(raw));
      }}
    />
  );
}

function TextareaControl({ id, value, onChange, field, disabled }) {
  return (
    <textarea
      id={id}
      className="ui-input ui-input--area"
      rows={field.rows || 4}
      value={value ?? ''}
      placeholder={field.placeholder || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectControl({ id, value, onChange, field, disabled }) {
  const options = typeof field.options === 'function' ? field.options() : field.options || [];
  return (
    <select
      id={id}
      className="ui-input ui-input--select"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
    >
      <option value="">{field.placeholder || '— none —'}</option>
      {options.map((opt) => {
        const optValue = typeof opt === 'object' ? opt.value : opt;
        const optLabel = typeof opt === 'object' ? opt.label : opt;
        return (
          <option key={String(optValue)} value={optValue}>
            {optLabel}
          </option>
        );
      })}
    </select>
  );
}

function BooleanControl({ id, value, onChange, field, disabled }) {
  return (
    <label className="ui-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__thumb" />
      </span>
      <span className="ui-switch__label">{field.checkboxLabel || (value ? 'On' : 'Off')}</span>
    </label>
  );
}

/** Comma-separated free text ↔ string[]. Used for tags, days, keywords. */
function TagsControl({ id, value, onChange, field, disabled }) {
  const asText = Array.isArray(value) ? value.join(', ') : value ?? '';
  return (
    <input
      id={id}
      className="ui-input"
      type="text"
      value={asText}
      placeholder={field.placeholder || 'comma, separated, values'}
      disabled={disabled}
      onChange={(e) => {
        const parts = e.target.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onChange(parts);
      }}
    />
  );
}

/** Fixed set of checkboxes producing an array — days of week, feature flags. */
function MultiSelectControl({ id, value, onChange, field, disabled }) {
  const options = typeof field.options === 'function' ? field.options() : field.options || [];
  const selected = Array.isArray(value) ? value : [];
  const toggle = (optValue) => {
    const next = selected.includes(optValue)
      ? selected.filter((v) => v !== optValue)
      : [...selected, optValue];
    onChange(next);
  };
  return (
    <div className="ui-multi" id={id}>
      {options.map((opt) => {
        const optValue = typeof opt === 'object' ? opt.value : opt;
        const optLabel = typeof opt === 'object' ? opt.label : opt;
        const active = selected.includes(optValue);
        return (
          <button
            key={String(optValue)}
            type="button"
            disabled={disabled}
            className={`ui-multi__chip ${active ? 'is-active' : ''}`}
            onClick={() => toggle(optValue)}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}

/** URL + inline preview, for hero images and photo URLs. */
function ImageUrlControl({ id, value, onChange, field, disabled }) {
  return (
    <div className="ui-imageurl">
      <input
        id={id}
        className="ui-input"
        type="url"
        value={value ?? ''}
        placeholder={field.placeholder || 'https://…'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <img
          className="ui-imageurl__preview"
          src={value}
          alt=""
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
          onLoad={(e) => {
            e.currentTarget.style.visibility = 'visible';
          }}
        />
      ) : null}
    </div>
  );
}

/** Free-form JSON, for the `metadata` columns the GCR schema exposes. */
function JsonControl({ id, value, onChange, field, disabled }) {
  const asText =
    typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
  return (
    <textarea
      id={id}
      className="ui-input ui-input--area mono"
      rows={field.rows || 6}
      value={asText}
      placeholder={field.placeholder || '{ }'}
      disabled={disabled}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const CONTROLS = {
  text: TextControl,
  email: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'email' }} />,
  url: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'url' }} />,
  tel: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'tel' }} />,
  password: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'password' }} />,
  date: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'date' }} />,
  time: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'time' }} />,
  datetime: (props) => (
    <TextControl {...props} field={{ ...props.field, inputType: 'datetime-local' }} />
  ),
  color: (props) => <TextControl {...props} field={{ ...props.field, inputType: 'color' }} />,
  number: NumberControl,
  textarea: TextareaControl,
  select: SelectControl,
  boolean: BooleanControl,
  tags: TagsControl,
  multiselect: MultiSelectControl,
  image: ImageUrlControl,
  json: JsonControl,
};

/** Register a control at runtime so a section can add one without editing this file. */
export function registerControl(type, component) {
  CONTROLS[type] = component;
}

export function Field({ field, value, onChange, error, disabled }) {
  const generatedId = useId();
  const id = field.name ? `field-${field.name}-${generatedId}` : generatedId;
  const Control = CONTROLS[field.type] || CONTROLS.text;

  if (field.type === 'custom' && typeof field.render === 'function') {
    return (
      <div className={`ui-field ${field.span ? `ui-field--span-${field.span}` : ''}`}>
        {field.label && <label className="ui-field__label">{field.label}</label>}
        {field.render({ value, onChange, disabled, field })}
        {field.help && <p className="ui-field__help">{field.help}</p>}
        {error && <p className="ui-field__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`ui-field ${field.span ? `ui-field--span-${field.span}` : ''}`}>
      {field.label && (
        <label className="ui-field__label" htmlFor={id}>
          {field.label}
          {field.required && <span className="ui-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      <Control id={id} field={field} value={value} onChange={onChange} disabled={disabled} />
      {field.help && <p className="ui-field__help">{field.help}</p>}
      {error && <p className="ui-field__error">{error}</p>}
    </div>
  );
}

export default Field;
