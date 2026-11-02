import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptionalValue } from '../src/ui/formValues.js';

test('optional temporal inputs can be left empty or cleared', () => {
  for (const type of ['date','time','datetime']) assert.equal(normalizeOptionalValue(type,''),null);
  assert.equal(normalizeOptionalValue('time','14:30'),'14:30');
  assert.equal(normalizeOptionalValue('date','2026-11-02'),'2026-11-02');
  assert.equal(normalizeOptionalValue('datetime','2026-11-02T14:30'),'2026-11-02T14:30');
});
test('normalization preserves ordinary text, booleans, zero and null', () => {
  assert.equal(normalizeOptionalValue('text',''),'');
  assert.equal(normalizeOptionalValue('boolean',false),false);
  assert.equal(normalizeOptionalValue('number',0),0);
  assert.equal(normalizeOptionalValue('time',null),null);
});
