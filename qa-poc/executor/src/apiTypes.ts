import type { TestCase, TestStep, TranslationError } from './types.js';

export type { TestCase, TestStep, TranslationError };

export interface IdentifiedTestCase {
  id: string;
  testCase: TestCase;
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
  | { storyIndex: number; story: string; status: 'ok'; testCases: IdentifiedTestCase[] }
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
}

export interface RunStartPayload {
  runId: string;
  totalTests: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
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
}

export interface TestReport {
  id: string;
  name: string;
  outcome: 'PASS' | 'FAIL';
  steps: StepReport[];
  reason?: string;
}

export interface RunReportResponse {
  runId: string;
  status: 'running' | 'complete';
  startedAt: string;
  completedAt?: string;
  reports: TestReport[];
  summary?: RunSummary;
}
