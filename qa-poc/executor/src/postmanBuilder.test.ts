import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPostmanCollection, jsonPathToJsAccess } from './postmanBuilder.js';
import type { TestCase } from './types.js';
import type { ApiTranslatedStep } from './apiValidator.js';

describe('jsonPathToJsAccess', () => {
  it('converts bracket notation', () => {
    assert.equal(jsonPathToJsAccess('data[0].email'), 'json.data[0].email');
    assert.equal(jsonPathToJsAccess('page'), 'json.page');
  });
});

describe('buildPostmanCollection', () => {
  const testCase: TestCase = {
    name: 'List users',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'when', action: 'send GET request', target_hint: 'GET /api/users' },
      { type: 'then', action: 'assert status code', target_hint: 'status: 200' },
      { type: 'then', action: 'assert JSON field', target_hint: 'json: data[0].email', value: 'george.bluth@reqres.in' },
    ],
  };

  const steps: ApiTranslatedStep[] = [
    { kind: 'request', method: 'GET', path: '/api/users' },
    { kind: 'assertStatus', code: 200 },
    { kind: 'assertJson', jsonPath: 'data[0].email', expected: 'george.bluth@reqres.in' },
  ];

  it('builds a Postman collection with one request item', () => {
    const { collection, groups } = buildPostmanCollection(testCase, steps, 'https://reqres.in');
    assert.equal(collection.item.length, 1);
    assert.equal(collection.item[0].request.method, 'GET');
    assert.equal(groups.length, 1);
    assert.equal(groups[0].assertions.length, 2);
  });

  it('emits Chai pm.test scripts for status and JSON assertions', () => {
    const { collection } = buildPostmanCollection(testCase, steps, 'https://reqres.in');
    const script = collection.item[0].event?.[0].script.exec.join('\n') ?? '';
    assert.match(script, /pm\.test\("assert status code"/);
    assert.match(script, /pm\.response\.to\.have\.status\(200\)/);
    assert.match(script, /pm\.test\("assert JSON field"/);
    assert.match(script, /pm\.expect\(json\.data\[0\]\.email\)\.to\.eql\("george\.bluth@reqres\.in"\)/);
  });

  it('uses baseUrl collection variable for relative paths', () => {
    const { collection } = buildPostmanCollection(testCase, steps, 'https://reqres.in');
    assert.equal(collection.variable[0].value, 'https://reqres.in');
    assert.equal(collection.item[0].request.url, '{{baseUrl}}/api/users');
  });

  it('emits numeric literals for numeric expected JSON values', () => {
    const numericCase: TestCase = {
      ...testCase,
      steps: [
        { type: 'when', action: 'send GET request', target_hint: 'GET /api/users' },
        { type: 'then', action: 'assert JSON field', target_hint: 'json: page', value: '1' },
      ],
    };
    const numericSteps: ApiTranslatedStep[] = [
      { kind: 'request', method: 'GET', path: '/api/users' },
      { kind: 'assertJson', jsonPath: 'page', expected: '1' },
    ];
    const { collection } = buildPostmanCollection(numericCase, numericSteps, 'https://reqres.in');
    const script = collection.item[0].event?.[0].script.exec.join('\n') ?? '';
    assert.match(script, /pm\.expect\(json\.page\)\.to\.eql\(1\)/);
  });
});
