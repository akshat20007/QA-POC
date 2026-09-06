import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyApiAction, parseHttpHint, validateApiTestCase, getJsonPath } from './apiValidator.js';
import type { TestCase } from './types.js';

describe('classifyApiAction', () => {
  it('recognizes request actions', () => {
    assert.equal(classifyApiAction('send GET request'), 'request');
    assert.equal(classifyApiAction('call API endpoint'), 'request');
  });

  it('recognizes assertion actions', () => {
    assert.equal(classifyApiAction('assert status code'), 'assertStatus');
    assert.equal(classifyApiAction('assert JSON field'), 'assertJson');
    assert.equal(classifyApiAction('assert response header'), 'assertHeader');
  });
});

describe('parseHttpHint', () => {
  it('parses method and path', () => {
    assert.deepEqual(parseHttpHint('GET /api/users'), { method: 'GET', path: '/api/users' });
    assert.deepEqual(parseHttpHint('POST /api/users'), { method: 'POST', path: '/api/users' });
  });

  it('throws on invalid hint', () => {
    assert.throws(() => parseHttpHint('invalid'), /METHOD \/path/);
  });
});

describe('validateApiTestCase', () => {
  const validCase: TestCase = {
    name: 'List users',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'when', action: 'send GET request', target_hint: 'GET /api/users' },
      { type: 'then', action: 'assert status code', target_hint: 'status: 200' },
      { type: 'then', action: 'assert JSON field', target_hint: 'json: data[0].email' },
    ],
  };

  it('validates a well-formed API test case', () => {
    const result = validateApiTestCase(validCase);
    assert.equal(result.errors.length, 0);
    assert.equal(result.translated.length, 3);
  });

  it('reports errors for bad status hint', () => {
    const bad: TestCase = {
      ...validCase,
      steps: [{ type: 'then', action: 'assert status code', target_hint: 'bad hint' }],
    };
    const result = validateApiTestCase(bad);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /status:/);
  });
});

describe('getJsonPath', () => {
  it('resolves nested paths', () => {
    const obj = { data: [{ email: 'test@example.com' }] };
    assert.equal(getJsonPath(obj, 'data[0].email'), 'test@example.com');
  });
});
