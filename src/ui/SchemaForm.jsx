/**
 * Schema-driven form.
 *
 * Sections describe their fields as data and this renders, validates, and
 * submits them. The Entity Editor's Info tab is ~30 fields; as a descriptor
 * array that stays readable and reorderable, where hand-written JSX would not.
 *
 * A field descriptor:
 *   {
 *     name: 'hero_image_url',       // required — key in the values object
 *     label: 'Hero image',
 *     type: 'image',                // any type registered in Field.jsx
 *     required: false,
 *     span: 'full' | 2 | 3,         // grid span
 *     help: 'Shown at the top of the public page',
 *     placeholder: 'https://…',
 *     options: [...] | () => [...], // select/multiselect
 *     validate: (value, values) => 'message' | null,
 *     visible: (values) => boolean, // conditional fields
 *     transform: (value) => value,  // applied on submit
 *   }
 *
 * Groups are optional: [{ title, description, fields: [...] }].
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Field } from './Field.jsx';
import { Button, ErrorState } from './primitives.jsx';
import './SchemaForm.css';

/** Normalize `fields` or `groups` into a single grouped shape. */
function toGroups(schema) {
  if (Array.isArray(schema?.groups)) return schema.groups;
  if (Array.isArray(schema)) return [{ fields: schema }];
  if (Array.isArray(schema?.fields)) return [{ fields: schema.fields }];
  return [];
}

function allFields(groups) {
  return groups.flatMap((g) => g.fields || []);
}

/** Build the initial values object from defaults + the row being edited. */
function buildInitial(fields, initialValues) {
  const out = {};
  for (const field of fields) {
    const existing = initialValues?.[field.name];
    if (existing !== undefined) {
      out[field.name] = existing;
    } else if (field.defaultValue !== undefined) {
      out[field.name] = typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue;
    } else {
      out[field.name] = defaultForType(field.type);
    }
  }
  return out;
}

function defaultForType(type) {
  switch (type) {
    case 'boolean':
      return false;
    case 'tags':
    case 'multiselect':
      return [];
    case 'number':
      return null;
    default:
      return '';
  }
}

export function SchemaForm({
  schema,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  columns = 2,
  disabled = false,
  extraActions,
  /** Render just the fields; the caller supplies its own submit control. */
  headless = false,
}) {
  const groups = useMemo(() => toGroups(schema), [schema]);
  const fields = useMemo(() => allFields(groups), [groups]);

  const [values, setValues] = useState(() => buildInitial(fields, initialValues));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Re-seed when the caller swaps the row being edited.
  const initialKey = useMemo(() => JSON.stringify(initialValues ?? null), [initialValues]);
  useEffect(() => {
    setValues(buildInitial(fields, initialValues));
    setErrors({});
    setSubmitError(null);
    // `initialKey` stands in for a deep compare of initialValues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, fields]);

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
  }, []);

  const visibleFields = useMemo(
    () => fields.filter((f) => (typeof f.visible === 'function' ? f.visible(values) : true)),
    [fields, values],
  );

  const validate = useCallback(() => {
    const next = {};
    for (const field of visibleFields) {
      const value = values[field.name];
      if (field.required) {
        const empty =
          value === null ||
          value === undefined ||
          value === '' ||
          (Array.isArray(value) && value.length === 0);
        if (empty) {
          next[field.name] = `${field.label || field.name} is required`;
          continue;
        }
      }
      if (typeof field.validate === 'function') {
        const message = field.validate(value, values);
        if (message) next[field.name] = message;
      }
      if (field.type === 'json' && typeof value === 'string' && value.trim()) {
        try {
          JSON.parse(value);
        } catch {
          next[field.name] = 'Not valid JSON';
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [visibleFields, values]);

  /** Apply per-field transforms and drop fields hidden by `visible`. */
  const collect = useCallback(() => {
    const out = {};
    for (const field of visibleFields) {
      let value = values[field.name];
      if (field.type === 'json' && typeof value === 'string') {
        value = value.trim() ? JSON.parse(value) : null;
      }
      if (typeof field.transform === 'function') value = field.transform(value, values);
      if (field.omitWhenEmpty && (value === '' || value === null || value === undefined)) continue;
      out[field.name] = value;
    }
    return out;
  }, [visibleFields, values]);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      setSubmitError(null);
      if (!validate()) return;
      setSaving(true);
      try {
        await onSubmit?.(collect(), values);
      } catch (err) {
        setSubmitError(err);
      } finally {
        setSaving(false);
      }
    },
    [validate, collect, onSubmit, values],
  );

  const body = (
    <>
      {groups.map((group, groupIndex) => {
        const groupFields = (group.fields || []).filter((f) =>
          typeof f.visible === 'function' ? f.visible(values) : true,
        );
        if (groupFields.length === 0) return null;
        return (
          <fieldset className="ui-form__group" key={group.title || groupIndex} disabled={disabled || saving}>
            {group.title && <legend className="ui-form__legend">{group.title}</legend>}
            {group.description && <p className="ui-form__groupdesc">{group.description}</p>}
            <div
              className="ui-form__grid"
              style={{ gridTemplateColumns: `repeat(${group.columns || columns}, minmax(0, 1fr))` }}
            >
              {groupFields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  error={errors[field.name]}
                  disabled={disabled || saving}
                  onChange={(value) => setValue(field.name, value)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
      {submitError && <ErrorState error={submitError} />}
    </>
  );

  if (headless) {
    return <div className="ui-form">{body}</div>;
  }

  return (
    <form className="ui-form" onSubmit={handleSubmit} noValidate>
      {body}
      <div className="ui-form__actions">
        {extraActions}
        <div className="spacer" />
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </Button>
        )}
        <Button variant="primary" type="submit" loading={saving} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default SchemaForm;
