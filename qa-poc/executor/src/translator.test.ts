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
