import type { TestCase } from './types.js';
import type { ApiTranslatedStep } from './apiValidator.js';

export interface PostmanCollection {
  info: { name: string; schema: string };
  variable: Array<{ key: string; value: string }>;
  item: PostmanItem[];
}

export interface PostmanItem {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string }>;
    url: string | { raw: string; host: string[]; path: string[] };
    body?: { mode: string; raw: string };
  };
  event?: Array<{ listen: string; script: { type: string; exec: string[] } }>;
}

/** Maps Newman execution results back to original test-case step indices. */
export interface ApiStepGroup {
  requestStepIndex: number;
  requestLabel: string;
  requestMethod: string;
  requestPath: string;
  assertions: Array<{
    stepIndex: number;
    label: string;
    kind: string;
    detailOnPass: string;
    testName: string;
  }>;
}

export interface BuiltPostmanCollection {
  collection: PostmanCollection;
  groups: ApiStepGroup[];
}

function escapeJsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Emits a JS literal for an expected value string (numbers unquoted). */
function expectedLiteral(value: string): string {
  if (/^-?\d+$/.test(value.trim())) return value.trim();
  if (/^-?\d+\.\d+$/.test(value.trim())) return value.trim();
  if (value.trim() === 'true') return 'true';
  if (value.trim() === 'false') return 'false';
  return JSON.stringify(value);
}

/** Converts json path like data[0].email to a JS property access on `json`. */
export function jsonPathToJsAccess(jsonPath: string): string {
  const normalized = jsonPath.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.').filter(Boolean);
  let expr = 'json';
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      expr += `[${part}]`;
    } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(part)) {
      expr += `.${part}`;
    } else {
      expr += `[${JSON.stringify(part)}]`;
    }
  }
  return expr;
}

function buildChaiScript(
  assertSteps: ApiTranslatedStep[],
  labels: string[],
): { exec: string[]; assertions: ApiStepGroup['assertions'] } {
  const exec: string[] = [];
  const assertions: ApiStepGroup['assertions'] = [];

  for (let i = 0; i < assertSteps.length; i++) {
    const step = assertSteps[i];
    const label = labels[i] ?? step.kind;
    const testName = escapeJsString(label);

    if (step.kind === 'assertStatus') {
      exec.push(
        `pm.test("${testName}", function () {`,
        `  pm.response.to.have.status(${step.code});`,
        `});`,
      );
      assertions.push({
        stepIndex: -1,
        label,
        kind: step.kind,
        detailOnPass: `status: ${step.code}`,
        testName: label,
      });
    } else if (step.kind === 'assertJson') {
      const access = jsonPathToJsAccess(step.jsonPath);
      if (step.expected !== undefined) {
        exec.push(
          `pm.test("${testName}", function () {`,
          `  const json = pm.response.json();`,
          `  pm.expect(${access}).to.eql(${expectedLiteral(step.expected)});`,
          `});`,
        );
        assertions.push({
          stepIndex: -1,
          label,
          kind: step.kind,
          detailOnPass: `json: ${step.jsonPath} = ${step.expected}`,
          testName: label,
        });
      } else {
        exec.push(
          `pm.test("${testName}", function () {`,
          `  const json = pm.response.json();`,
          `  pm.expect(${access}).to.exist;`,
          `});`,
        );
        assertions.push({
          stepIndex: -1,
          label,
          kind: step.kind,
          detailOnPass: `json: ${step.jsonPath}`,
          testName: label,
        });
      }
    } else if (step.kind === 'assertHeader') {
      const headerKey = escapeJsString(step.headerName);
      if (step.expected !== undefined) {
        exec.push(
          `pm.test("${testName}", function () {`,
          `  pm.expect(pm.response.headers.get("${headerKey}")).to.include(${JSON.stringify(step.expected)});`,
          `});`,
        );
        assertions.push({
          stepIndex: -1,
          label,
          kind: step.kind,
          detailOnPass: `header: ${step.headerName} = ${step.expected}`,
          testName: label,
        });
      } else {
        exec.push(
          `pm.test("${testName}", function () {`,
          `  pm.response.to.have.header("${headerKey}");`,
          `});`,
        );
        assertions.push({
          stepIndex: -1,
          label,
          kind: step.kind,
          detailOnPass: `header: ${step.headerName}`,
          testName: label,
        });
      }
    }
  }

  return { exec, assertions };
}

function resolveUrl(path: string): string | { raw: string; host: string[]; path: string[] } {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `{{baseUrl}}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Compiles validated API steps into a Postman Collection v2.1 with Chai pm.test scripts. */
export function buildPostmanCollection(
  testCase: TestCase,
  steps: ApiTranslatedStep[],
  baseUrl: string,
): BuiltPostmanCollection {
  const groups: ApiStepGroup[] = [];
  const items: PostmanItem[] = [];

  let i = 0;
  while (i < steps.length) {
    const step = steps[i];
    if (step.kind === 'precondition') {
      i += 1;
      continue;
    }
    if (step.kind !== 'request') {
      i += 1;
      continue;
    }

    const requestStepIndex = i;
    const requestLabel = testCase.steps[requestStepIndex]?.action ?? step.kind;
    i += 1;

    const assertSteps: ApiTranslatedStep[] = [];
    const assertLabels: string[] = [];
    while (i < steps.length && steps[i].kind !== 'request' && steps[i].kind !== 'precondition') {
      assertSteps.push(steps[i]);
      assertLabels.push(testCase.steps[i]?.action ?? steps[i].kind);
      i += 1;
    }

    const { exec, assertions } = buildChaiScript(assertSteps, assertLabels);
    for (let j = 0; j < assertions.length; j++) {
      assertions[j].stepIndex = requestStepIndex + 1 + j;
    }

    const item: PostmanItem = {
      name: `${requestLabel} (${step.method} ${step.path})`,
      request: {
        method: step.method,
        header: [{ key: 'Content-Type', value: 'application/json' }],
        url: resolveUrl(step.path),
      },
    };

    if (step.body && ['POST', 'PUT', 'PATCH'].includes(step.method)) {
      item.request.body = { mode: 'raw', raw: step.body };
    }

    if (exec.length > 0) {
      item.event = [{ listen: 'test', script: { type: 'text/javascript', exec } }];
    }

    items.push(item);
    groups.push({
      requestStepIndex,
      requestLabel,
      requestMethod: step.method,
      requestPath: step.path,
      assertions,
    });
  }

  return {
    collection: {
      info: {
        name: testCase.name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [{ key: 'baseUrl', value: baseUrl }],
      item: items,
    },
    groups,
  };
}

/** Flat ordered step indices for a test case (request + assertions in execution order). */
export function flattenStepOrder(groups: ApiStepGroup[]): number[] {
  const indices: number[] = [];
  for (const group of groups) {
    indices.push(group.requestStepIndex);
    for (const a of group.assertions) {
      indices.push(a.stepIndex);
    }
  }
  return indices;
}
