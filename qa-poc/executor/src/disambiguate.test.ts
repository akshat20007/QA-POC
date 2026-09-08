import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errors as playwrightErrors } from 'playwright';
import { isStrictModeViolation, chooseDisambiguation } from './disambiguate.js';

test('isStrictModeViolation: detects a real strict-mode-violation message and extracts matchCount', () => {
  const error = new Error(
    "locator.click: Error: strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 6 elements:\n" +
      "    1) <button>Add to cart</button> aka getByRole('button', { name: 'Add to cart' }).first()\n" +
      "    2) <button>Add to cart</button> aka getByRole('button', { name: 'Add to cart' }).nth(1)",
  );
  const result = isStrictModeViolation(error);
  assert.ok(result);
  assert.equal(result.matchCount, 6);
});

test('isStrictModeViolation: returns null for a TimeoutError (zero-match failure)', () => {
  const error = new playwrightErrors.TimeoutError(
    "locator.click: Timeout 8000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Nonexistent' })",
  );
  assert.equal(isStrictModeViolation(error), null);
});

test('isStrictModeViolation: returns null for an unrelated error', () => {
  assert.equal(isStrictModeViolation(new Error('page.goto: net::ERR_CONNECTION_REFUSED')), null);
  assert.equal(isStrictModeViolation('not even an Error instance'), null);
});

test('chooseDisambiguation: valid filterText resolves to a filter choice', () => {
  const result = chooseDisambiguation(6, { filterText: 'Sauce Labs Backpack', reasoning: '...' });
  assert.deepEqual(result, { method: 'filter', filterText: 'Sauce Labs Backpack' });
});

test('chooseDisambiguation: valid in-range index resolves to an nth choice', () => {
  const result = chooseDisambiguation(6, { index: 3, reasoning: '...' });
  assert.deepEqual(result, { method: 'nth', index: 3 });
});

test('chooseDisambiguation: out-of-range index is rejected', () => {
  assert.equal(chooseDisambiguation(6, { index: 6, reasoning: '...' }), null);
  assert.equal(chooseDisambiguation(6, { index: -1, reasoning: '...' }), null);
});

test('chooseDisambiguation: neither filterText nor index present is rejected', () => {
  assert.equal(chooseDisambiguation(6, { reasoning: 'not sure' }), null);
});

test('chooseDisambiguation: filterText wins when both are present', () => {
  const result = chooseDisambiguation(6, { filterText: 'Sauce Labs Bike Light', index: 1, reasoning: '...' });
  assert.deepEqual(result, { method: 'filter', filterText: 'Sauce Labs Bike Light' });
});

test('chooseDisambiguation: blank filterText falls back to index', () => {
  const result = chooseDisambiguation(6, { filterText: '   ', index: 2, reasoning: '...' });
  assert.deepEqual(result, { method: 'nth', index: 2 });
});
