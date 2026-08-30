export type StepType = 'given' | 'when' | 'then';

export interface TestStep {
  type: StepType;
  action: string;
  target_hint: string;
  value?: string;
}

export interface TestCase {
  name: string;
  priority: 'high' | 'medium' | 'low';
  category: 'happy-path' | 'edge-case' | 'negative';
  steps: TestStep[];
}

export interface IdentifiedTestCase {
  id: string;
  testCase: TestCase;
  /** Which submitted story (by index) generated this test case; undefined for manually added ones. Display-only. */
  storyIndex?: number;
  /** Short preview of that story's text, for grouping headers in the Review UI. Display-only. */
  storyPreview?: string;
}

export interface TranslationError {
  index: number;
  step: TestStep;
  message: string;
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

export interface GenerateResponse {
  batchId: string;
  results: GenerateStoryResult[];
}

export interface ValidateResponse {
  results: Array<{ id: string; errors: TranslationError[] }>;
}

export interface CreateRunResponse {
  runId: string;
}

export interface StepResultPayload {
  testId: string;
  stepIndex: number;
  action: string;
  label: string;
  outcome: 'pass' | 'fail';
  selectorUsed?: string;
  error?: string;
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

export interface HealthResponse {
  ok: boolean;
  geminiKeyConfigured: boolean;
}
