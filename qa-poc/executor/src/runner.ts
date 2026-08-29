import { EventEmitter } from 'node:events';
import type { Browser, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { translateTestCase } from './translator.js';
import { applyStep, withRetry, BASE_URL, ACTION_TIMEOUT_MS } from './executor.js';
import type { TestCase } from './types.js';
import type { RunEvent, TestReport } from './apiTypes.js';

export interface RunnableTestCase {
  id: string;
  testCase: TestCase;
}

export interface RunnerOptions {
  headless?: boolean;
}

function emit(emitter: EventEmitter, event: RunEvent): void {
  emitter.emit('event', event);
}

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;

/** Playwright error messages carry ANSI color codes meant for terminal output; strip them for HTML/JSON display. */
function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

async function runOne(
  browser: Browser,
  item: RunnableTestCase,
  index: number,
  totalTests: number,
  emitter: EventEmitter,
): Promise<TestReport> {
  const { id, testCase } = item;

  emit(emitter, { type: 'test-start', payload: { testId: id, name: testCase.name, index, totalTests } });

  const { translated, errors } = translateTestCase(testCase);

  if (errors.length > 0) {
    const reason = `Translation failed: ${errors
      .map((e) => `step ${e.index} ("${e.step.action}"): ${e.message}`)
      .join('; ')}`;
    emit(emitter, { type: 'test-end', payload: { testId: id, outcome: 'FAIL', reason } });
    return { id, name: testCase.name, outcome: 'FAIL', steps: [], reason };
  }

  const steps: TestReport['steps'] = [];
  let failReason: string | undefined;
  let context: BrowserContext | undefined;

  try {
    context = await browser.newContext({ baseURL: BASE_URL });
    context.setDefaultTimeout(ACTION_TIMEOUT_MS);
    const page = await context.newPage();

    for (let stepIndex = 0; stepIndex < translated.length; stepIndex++) {
      const step = translated[stepIndex];
      const label = testCase.steps[stepIndex]?.action ?? step.kind;
      try {
        const { selectorUsed } = await withRetry(() => applyStep(page, step));
        steps.push({ action: step.kind, label, selectorUsed, outcome: 'pass' });
        emit(emitter, {
          type: 'step-result',
          payload: { testId: id, stepIndex, action: step.kind, label, outcome: 'pass', selectorUsed },
        });
      } catch (exc) {
        const message = stripAnsi(exc instanceof Error ? exc.message : String(exc));
        steps.push({ action: step.kind, label, outcome: 'fail', error: message });
        emit(emitter, {
          type: 'step-result',
          payload: { testId: id, stepIndex, action: step.kind, label, outcome: 'fail', error: message },
        });
        failReason = `Step "${step.kind}" failed after retry: ${message}`;
        break;
      }
    }
  } finally {
    await context?.close();
  }

  const outcome: 'PASS' | 'FAIL' = failReason ? 'FAIL' : 'PASS';
  emit(emitter, { type: 'test-end', payload: { testId: id, outcome, reason: failReason } });

  return { id, name: testCase.name, outcome, steps, reason: failReason };
}

/** Runs a list of test cases against one shared browser, emitting progress events as it goes.
 * Never rejects: any failure (browser launch, an unexpected per-test crash) is reported via
 * an 'error' event, and whatever reports were already completed are still returned rather
 * than discarded - callers should never see a run's earlier passes vanish because a later
 * test crashed instead of merely failing. */
export async function runTestCases(
  runId: string,
  testCases: RunnableTestCase[],
  emitter: EventEmitter,
  opts: RunnerOptions = {},
): Promise<TestReport[]> {
  const headless = opts.headless ?? true;
  const totalTests = testCases.length;

  emit(emitter, { type: 'run-start', payload: { runId, totalTests } });

  const reports: TestReport[] = [];
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless });
    for (let index = 0; index < testCases.length; index++) {
      reports.push(await runOne(browser, testCases[index], index, totalTests, emitter));
    }
    const summary = {
      total: reports.length,
      passed: reports.filter((r) => r.outcome === 'PASS').length,
      failed: reports.filter((r) => r.outcome === 'FAIL').length,
    };
    emit(emitter, { type: 'run-complete', payload: { runId, summary } });
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    emit(emitter, { type: 'error', payload: { message } });
  } finally {
    await browser?.close();
  }

  return reports;
}
