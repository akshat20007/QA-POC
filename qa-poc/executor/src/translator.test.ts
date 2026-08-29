import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateTestCase } from './translator.js';
import type { TestCase } from './types.js';

test('login_valid-shaped case: navigate, fill x2, click, checkVisible', () => {
  const testCase: TestCase = {
    name: 'Successful login',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'given', action: 'navigate to login page', target_hint: 'https://www.saucedemo.com/' },
      { type: 'when', action: 'fill username', target_hint: 'textbox: Username', value: 'standard_user' },
      { type: 'when', action: 'fill password', target_hint: 'textbox: Password', value: 'secret_sauce' },
      { type: 'when', action: 'click login button', target_hint: 'button: Login' },
      { type: 'then', action: 'assert products page title visible', target_hint: 'Products' },
    ],
  };

  const result = translateTestCase(testCase);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.translated, [
    { kind: 'navigate', url: 'https://www.saucedemo.com/' },
    { kind: 'fill', locator: { strategy: 'role', role: 'textbox', name: 'Username' }, value: 'standard_user' },
    { kind: 'fill', locator: { strategy: 'role', role: 'textbox', name: 'Password' }, value: 'secret_sauce' },
    { kind: 'click', locator: { strategy: 'role', role: 'button', name: 'Login' } },
    { kind: 'checkVisible', locator: { strategy: 'text', text: 'Products' } },
  ]);
});

test('add_to_cart-shaped case: checkText step uses text: prefix locator', () => {
  const testCase: TestCase = {
    name: 'Add product to cart',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'when', action: 'click add to cart button', target_hint: 'button: Add to cart' },
      { type: 'then', action: 'assert cart badge shows 1', target_hint: 'text: 1' },
    ],
  };

  const result = translateTestCase(testCase);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.translated, [
    { kind: 'click', locator: { strategy: 'role', role: 'button', name: 'Add to cart' } },
    { kind: 'checkText', locator: { strategy: 'text', text: '1' }, text: '1' },
  ]);
});

test('unrecognized action is captured as an error, not thrown', () => {
  const testCase: TestCase = {
    name: 'Weird case',
    priority: 'low',
    category: 'edge-case',
    steps: [
      { type: 'when', action: 'hover over menu', target_hint: 'link: Menu' },
      { type: 'when', action: 'click ok button', target_hint: 'button: OK' },
    ],
  };

  const result = translateTestCase(testCase);

  assert.equal(result.translated.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].index, 0);
  assert.match(result.errors[0].message, /Unrecognized action/);
});

test('nameless role hint via trailing colon resolves to a role-only locator', () => {
  const testCase: TestCase = {
    name: 'Sort products, colon form',
    priority: 'medium',
    category: 'happy-path',
    steps: [
      { type: 'when', action: 'select price low to high sort option', target_hint: 'combobox:', value: 'Price (low to high)' },
    ],
  };

  const result = translateTestCase(testCase);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.translated, [
    { kind: 'select', locator: { strategy: 'role', role: 'combobox' }, value: 'Price (low to high)' },
  ]);
});

test('nameless role hint via bare keyword resolves to a role-only locator', () => {
  const testCase: TestCase = {
    name: 'Sort products, bare form',
    priority: 'medium',
    category: 'happy-path',
    steps: [
      { type: 'when', action: 'select price low to high sort option', target_hint: 'combobox', value: 'Price (low to high)' },
    ],
  };

  const result = translateTestCase(testCase);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.translated, [
    { kind: 'select', locator: { strategy: 'role', role: 'combobox' }, value: 'Price (low to high)' },
  ]);
});

test('checkText step with a nameless role hint is captured as an error', () => {
  const testCase: TestCase = {
    name: 'Nameless checkText case',
    priority: 'low',
    category: 'edge-case',
    steps: [{ type: 'then', action: 'assert something is listed', target_hint: 'combobox:' }],
  };

  const result = translateTestCase(testCase);

  assert.equal(result.translated.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /needs a named target_hint/);
});

test('select step: dropdown target_hint plus option value', () => {
  const testCase: TestCase = {
    name: 'Sort products',
    priority: 'medium',
    category: 'happy-path',
    steps: [
      {
        type: 'when',
        action: 'select price low to high sort option',
        target_hint: 'combobox: Sort by',
        value: 'Price (low to high)',
      },
    ],
  };

  const result = translateTestCase(testCase);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.translated, [
    {
      kind: 'select',
      locator: { strategy: 'role', role: 'combobox', name: 'Sort by' },
      value: 'Price (low to high)',
    },
  ]);
});

test('select step missing value is captured as an error', () => {
  const testCase: TestCase = {
    name: 'Missing select value case',
    priority: 'medium',
    category: 'happy-path',
    steps: [{ type: 'when', action: 'select sort option', target_hint: 'combobox: Sort by' }],
  };

  const result = translateTestCase(testCase);

  assert.equal(result.translated.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /has no value \(option\) to select/);
});

test('fill step missing value is captured as an error', () => {
  const testCase: TestCase = {
    name: 'Missing value case',
    priority: 'medium',
    category: 'happy-path',
    steps: [{ type: 'when', action: 'fill username', target_hint: 'textbox: Username' }],
  };

  const result = translateTestCase(testCase);

  assert.equal(result.translated.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /has no value to type/);
});
