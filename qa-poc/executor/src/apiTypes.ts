import type { StoryType, TestCase, TestStep, TranslationError } from './types.js';

export type { StoryType, TestCase, TestStep, TranslationError };

export interface IdentifiedTestCase {
  id: string;
  testCase: TestCase;
  storyType: StoryType;
  /** Which submitted story (by index) generated this test case; undefined for manually added ones. Display-only. */
  storyIndex?: number;
  /** Short preview of that story's text, for grouping headers in the Review UI. Display-only. */
  storyPreview?: string;
}

export type GenerationErrorType =
  | 'missing_key'
  | 'api_error'
  | 'json_error'
  | 'node_parse_error'
  | 'timeout'
  | 'unknown';

export type GenerateStoryResult =
  | { storyIndex: number; story: string; status: 'ok'; storyType: StoryType; testCases: IdentifiedTestCase[] }
  | { storyIndex: number; story: string; status: 'error'; error: string; errorType: GenerationErrorType };

export interface GenerateRequest {
  stories: string[];
}

export interface GenerateResponse {
  batchId: string;
  results: GenerateStoryResult[];
}

export interface ValidateRequest {
  testCases: IdentifiedTestCase[];
}

export interface ValidateResponse {
  results: Array<{ id: string; errors: TranslationError[] }>;
}

export interface CreateRunRequest {
  testCases: IdentifiedTestCase[];
}

export interface CreateRunResponse {
  runId: string;
}

export interface StepResultPayload {
  testId: string;
  stepIndex: number;
  /** Technical step kind (navigate/click/fill/checkVisible/checkText) - matches the CLI's existing report field. */
  action: string;
  /** Original human-readable action text from the test case, e.g. "fill username". */
  label: string;
  outcome: 'pass' | 'fail';
  selectorUsed?: string;
  error?: string;
  /** Base64-encoded PNG of the page at the moment this step failed. Only set when outcome is 'fail'. */
  screenshot?: string;
  /** Path (relative to qa-poc/) of the same screenshot as saved to disk. Only set when outcome is 'fail'. */
  screenshotPath?: string;
  /** True if this step's locator hit a Playwright strict-mode violation (N>1 matches) and was
   * resolved via the live disambiguation fallback (disambiguate.ts) instead of failing outright. */
  disambiguated?: boolean;
  /** Human-readable resolved selector, e.g. "...filter({ hasText: 'Sauce Labs Bike Light' })" or
   * "...nth(1)". Only set when disambiguated is true. */
  disambiguationDetail?: string;
  /** True whenever a strict-mode violation was hit and the fallback was attempted, regardless of
   * outcome - lets a FAILED step's report distinguish "not applicable" from "tried, still failed." */
  disambiguationAttempted?: boolean;
}

export interface TestStartPayload {
  testId: string;
  name: string;
  index: number;
  totalTests: number;
}

export interface TestEndPayload {
  testId: string;
  outcome: 'PASS' | 'FAIL';
  reason?: string;
  /** Path (relative to qa-poc/) of the Playwright trace captured for this test. Only set when
   * outcome is 'FAIL' - traces for passing tests are discarded to avoid unbounded disk growth. */
  tracePath?: string;
}

export interface RunStartPayload {
  runId: string;
  totalTests: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  /** Count of steps, across the whole run, resolved via the live disambiguation fallback. */
  disambiguatedSteps: number;
}

export interface RunCompletePayload {
  runId: string;
  summary: RunSummary;
}

export interface RunErrorPayload {
  message: string;
}

export type RunEvent =
  | { type: 'run-start'; payload: RunStartPayload }
  | { type: 'test-start'; payload: TestStartPayload }
  | { type: 'step-result'; payload: StepResultPayload }
  | { type: 'test-end'; payload: TestEndPayload }
  | { type: 'run-complete'; payload: RunCompletePayload }
  | { type: 'error'; payload: RunErrorPayload };

export interface StepReport {
  action: string;
  label: string;
  selectorUsed?: string;
  outcome: 'pass' | 'fail';
  error?: string;
  /** Base64-encoded PNG of the page at the moment this step failed. Only set when outcome is 'fail'. */
  screenshot?: string;
  /** Path (relative to qa-poc/) of the same screenshot as saved to disk. Only set when outcome is 'fail'. */
  screenshotPath?: string;
  /** True if this step's locator hit a Playwright strict-mode violation (N>1 matches) and was
   * resolved via the live disambiguation fallback (disambiguate.ts) instead of failing outright. */
  disambiguated?: boolean;
  /** Human-readable resolved selector, e.g. "...filter({ hasText: 'Sauce Labs Bike Light' })" or
   * "...nth(1)". Only set when disambiguated is true. */
  disambiguationDetail?: string;
  /** True whenever a strict-mode violation was hit and the fallback was attempted, regardless of
   * outcome - lets a FAILED step's report distinguish "not applicable" from "tried, still failed." */
  disambiguationAttempted?: boolean;
}

export interface TestReport {
  id: string;
  name: string;
  outcome: 'PASS' | 'FAIL';
  steps: StepReport[];
  reason?: string;
  /** Path (relative to qa-poc/) of the Playwright trace captured for this test. Only set when
   * outcome is 'FAIL' - traces for passing tests are discarded to avoid unbounded disk growth. */
  tracePath?: string;
}

export interface RunReportResponse {
  runId: string;
  status: 'running' | 'complete';
  startedAt: string;
  completedAt?: string;
  reports: TestReport[];
  summary?: RunSummary;
}
