import { errors as playwrightErrors } from 'playwright';
import type { Page, Locator } from 'playwright';
import { GoogleGenAI } from '@google/genai';
import { locatorFor, describeSelector } from './executor.js';
import type { LocatorSpec, TranslatedStep } from './types.js';

// Same model generate.py uses (generate.py:18), for cost/latency consistency between
// generation-time and this rare execution-time fallback call.
const MODEL = 'gemini-flash-lite-latest';
const DISAMBIGUATION_TIMEOUT_MS = 15_000;
const MAX_SNAPSHOT_CHARS = 20_000;

const STRICT_MODE_PATTERN = /strict mode violation:.*resolved to (\d+) elements/is;

export interface StrictModeViolation {
  matchCount: number;
}

/** Detects specifically the "N>1 matches" failure class Playwright throws on an ambiguous
 * locator - never the "0 matches" (TimeoutError) class, which is a different, unrelated
 * problem (wrong role/name entirely) that this fallback must not attempt to "fix". */
export function isStrictModeViolation(error: unknown): StrictModeViolation | null {
  if (!(error instanceof Error) || error instanceof playwrightErrors.TimeoutError) return null;
  const match = STRICT_MODE_PATTERN.exec(error.message);
  return match ? { matchCount: Number(match[1]) } : null;
}

export interface DisambiguationBudget {
  used: number;
  max: number;
}

export interface DisambiguationRequest {
  page: Page;
  locatorSpec: LocatorSpec;
  actionLabel: string;
  stepKind: TranslatedStep['kind'];
  matchCount: number;
  budget: DisambiguationBudget;
}

export type DisambiguationResult =
  | { ok: true; locator: Locator; selectorUsed: string; method: 'filter' | 'nth'; rawModelResponse: string }
  | { ok: false; reason: string };

interface ModelChoice {
  filterText?: string;
  index?: number;
  reasoning?: string;
}

/** Pure, unit-testable: interprets the model's parsed JSON against the known matchCount.
 * No Page/network access - this is what disambiguate.test.ts exercises directly. filterText
 * wins over index when both are present, since a Playwright .filter({hasText}) is more
 * auditable in reports than a bare positional .nth(i). */
export function chooseDisambiguation(
  matchCount: number,
  response: ModelChoice,
): { method: 'filter'; filterText: string } | { method: 'nth'; index: number } | null {
  if (response.filterText && response.filterText.trim()) {
    return { method: 'filter', filterText: response.filterText.trim() };
  }
  if (
    typeof response.index === 'number' &&
    Number.isInteger(response.index) &&
    response.index >= 0 &&
    response.index < matchCount
  ) {
    return { method: 'nth', index: response.index };
  }
  return null;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    filterText: { type: 'string' },
    index: { type: 'integer' },
  },
  required: ['reasoning'],
};

function buildPrompt(req: DisambiguationRequest, snapshot: string): string {
  const truncated =
    snapshot.length > MAX_SNAPSHOT_CHARS
      ? `${snapshot.slice(0, MAX_SNAPSHOT_CHARS)}\n... (snapshot truncated, ${snapshot.length} chars total)`
      : snapshot;

  return (
    `A Playwright locator matched ${req.matchCount} elements instead of exactly one - this is a ` +
    `"strict mode violation". Locator: ${describeSelector(req.locatorSpec)}. The step's intent: ` +
    `"${req.actionLabel}".\n\n` +
    `Below is the page's accessibility snapshot (document order). Use the step's intent to work out ` +
    `which one of the ${req.matchCount} matching elements is meant, then respond with EITHER:\n` +
    `- "index": the 0-based position of the intended element among the ${req.matchCount} matches, ` +
    `counted in the same document order they appear in the snapshot below (the 1st matching element ` +
    `in the snapshot is index 0, the 2nd is index 1, and so on). Use this whenever the matching ` +
    `elements are identical/generic and what distinguishes them (e.g. a product name) is SEPARATE, ` +
    `nearby text in the snapshot rather than part of the element's own text - this is the common case ` +
    `for "one identical button/link per item in a list", and is almost always the right choice.\n` +
    `- "filterText": a short snippet of text that is part of the matching element's OWN accessible ` +
    `name/text (not nearby or sibling text), which narrows it to exactly one element via Playwright's ` +
    `.filter({ hasText }) applied to that same element. Only use this if the matching elements' own ` +
    `text genuinely differs from each other - if all ${req.matchCount} elements share the identical, ` +
    `generic name given above, "filterText" cannot work (it only matches text inside the element ` +
    `itself); use "index" instead.\n\n` +
    `Always include "reasoning" explaining your choice.\n\n` +
    `Accessibility snapshot:\n${truncated}`
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`disambiguation timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/** Live, execution-time fallback for a Playwright strict-mode violation: captures the page's
 * accessibility snapshot directly (Playwright's own locator.ariaSnapshot(), no separate MCP
 * server/process needed since this code already holds the live Page), asks Gemini to pick the
 * intended match, and returns a concrete Locator to retry the step with. Never throws - callers
 * get back an ok:false result on any failure so the original strict-mode error can still be
 * reported as the step's failure. */
export async function disambiguate(req: DisambiguationRequest): Promise<DisambiguationResult> {
  if (req.budget.used >= req.budget.max) {
    return { ok: false, reason: `disambiguation cap (${req.budget.max}) reached for this run` };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'GEMINI_API_KEY not set' };
  }

  req.budget.used += 1;

  const base = locatorFor(req.page, req.locatorSpec);

  let snapshot: string | null;
  try {
    snapshot = await req.page.locator('body').ariaSnapshot();
  } catch {
    snapshot = null;
  }
  if (!snapshot) {
    return { ok: false, reason: 'could not capture page accessibility snapshot' };
  }

  const prompt = buildPrompt(req, snapshot);

  let parsed: ModelChoice;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      DISAMBIGUATION_TIMEOUT_MS,
    );
    parsed = JSON.parse(response.text ?? '{}') as ModelChoice;
  } catch (exc) {
    return { ok: false, reason: `disambiguation LLM call failed: ${exc instanceof Error ? exc.message : String(exc)}` };
  }

  const choice = chooseDisambiguation(req.matchCount, parsed);
  if (!choice) {
    return { ok: false, reason: `model returned no usable filterText/index: ${JSON.stringify(parsed)}` };
  }

  if (choice.method === 'filter') {
    const candidate = base.filter({ hasText: choice.filterText });
    const count = await candidate.count();
    if (count !== 1) {
      return { ok: false, reason: `filterText "${choice.filterText}" matched ${count} elements, not 1` };
    }
    return {
      ok: true,
      locator: candidate,
      selectorUsed: `${describeSelector(req.locatorSpec)}.filter({ hasText: '${choice.filterText}' })`,
      method: 'filter',
      rawModelResponse: JSON.stringify(parsed),
    };
  }

  return {
    ok: true,
    locator: base.nth(choice.index),
    selectorUsed: `${describeSelector(req.locatorSpec)}.nth(${choice.index})`,
    method: 'nth',
    rawModelResponse: JSON.stringify(parsed),
  };
}
