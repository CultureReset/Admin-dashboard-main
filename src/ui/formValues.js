// Empty HTML date/time inputs are strings. Typed database columns accept
// null for an unset value, not an empty string. Preserve all nonempty values.
export function normalizeOptionalValue(type, value) {
  return ['date', 'time', 'datetime'].includes(type) && value === '' ? null : value;
}
