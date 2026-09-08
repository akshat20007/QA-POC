import type { TestCase, TestStep, TranslationError, TranslationResult } from './types.js';

export type ApiActionKind = 'request' | 'assertStatus' | 'assertJson' | 'assertHeader';

export type ApiTranslatedStep =
  | { kind: 'precondition' }
  | { kind: 'request'; method: string; path: string; body?: string }
  | { kind: 'assertStatus'; code: number }
  | { kind: 'assertJson'; jsonPath: string; expected?: string }
  | { kind: 'assertHeader'; headerName: string; expected?: string };

class StepValidationError extends Error {}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

/** Classifies free-text API action strings into HTTP step kinds. */
export function classifyApiAction(action: string): ApiActionKind | null {
  const a = action.toLowerCase();
  if (hasWord(a, 'request') || hasWord(a, 'call') || hasWord(a, 'send')) return 'request';
  if (hasWord(a, 'status')) return 'assertStatus';
  if (hasWord(a, 'json') || hasWord(a, 'body') || hasWord(a, 'field')) return 'assertJson';
  if (hasWord(a, 'header')) return 'assertHeader';
  return null;
}

/** Parses "GET /api/users?page=2" into method + path. */
export function parseHttpHint(hint: string): { method: string; path: string } {
  const trimmed = hint.trim();
  const match = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i.exec(trimmed);
  if (!match) {
    throw new StepValidationError(`HTTP target_hint must be "METHOD /path", got: "${hint}"`);
  }
  return { method: match[1].toUpperCase(), path: match[2] };
}

function translateApiStep(step: TestStep): ApiTranslatedStep {
  if (step.type === 'given') {
    return { kind: 'precondition' };
  }

  const kind = classifyApiAction(step.action);
  if (!kind) {
    throw new StepValidationError(`Unrecognized API action: "${step.action}"`);
  }

  if (kind === 'request') {
    const { method, path } = parseHttpHint(step.target_hint);
    return { kind: 'request', method, path, body: step.value };
  }

  if (kind === 'assertStatus') {
    const match = /^status:\s*(\d{3})$/i.exec(step.target_hint.trim());
    if (!match) {
      throw new StepValidationError(`Status assertion target_hint must be "status: <code>", got: "${step.target_hint}"`);
    }
    return { kind: 'assertStatus', code: Number(match[1]) };
  }

  if (kind === 'assertJson') {
    const match = /^json:\s*(.+)$/i.exec(step.target_hint.trim());
    if (!match) {
      throw new StepValidationError(`JSON assertion target_hint must be "json: <path>", got: "${step.target_hint}"`);
    }
    return { kind: 'assertJson', jsonPath: match[1].trim(), expected: step.value };
  }

  const headerMatch = /^header:\s*(.+)$/i.exec(step.target_hint.trim());
  if (!headerMatch) {
    throw new StepValidationError(`Header assertion target_hint must be "header: <name>", got: "${step.target_hint}"`);
  }
  return { kind: 'assertHeader', headerName: headerMatch[1].trim(), expected: step.value };
}

export function validateApiTestCase(testCase: TestCase): TranslationResult {
  const translated: ApiTranslatedStep[] = [];
  const errors: TranslationError[] = [];

  testCase.steps.forEach((step, index) => {
    try {
      translated.push(translateApiStep(step));
    } catch (exc) {
      errors.push({
        index,
        step,
        message: exc instanceof Error ? exc.message : String(exc),
      });
    }
  });

  return { translated: translated as unknown as TranslationResult['translated'], errors };
}

/** Resolves a dot/bracket JSON path like data[0].email from a response object. */
export function getJsonPath(obj: unknown, path: string): unknown {
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const token of tokens) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export type { ApiTranslatedStep as ApiStep };
