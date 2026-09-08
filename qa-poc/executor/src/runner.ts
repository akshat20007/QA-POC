import { EventEmitter } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { translateTestCase } from './translator.js';
import { applyStep, withRetry, BASE_URL, ACTION_TIMEOUT_MS } from './executor.js';
import { disambiguate, isStrictModeViolation } from './disambiguate.js';
import type { DisambiguationBudget, DisambiguationResult } from './disambiguate.js';
import { runOneApi } from './apiRunner.js';
import type { StoryType, TestCase } from './types.js';
import type { RunEvent, TestReport } from './apiTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '..', '..', 'output', 'screenshots');

function saveScreenshotFile(runId: string, testId: string, stepIndex: number, buffer: Buffer): string {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const fileName = `${runId}-${testId}-step${stepIndex}.png`;
  writeFileSync(path.join(SCREENSHOTS_DIR, fileName), buffer);
  return path.join('output', 'screenshots', fileName);
}

export interface RunnableTestCase {
  id: string;
  testCase: TestCase;
  storyType: StoryType;
}

export interface RunnerOptions {
  headless?: boolean;
  /** Caps how many live disambiguation-fallback calls (disambiguate.ts) a single runTestCases
   * call may make, across every test case in the run - bounds worst-case LLM spend if something
   * unexpected causes repeated strict-mode violations across a whole suite. */
  maxDisambiguationsPerRun?: number;
}

function emit(emitter: EventEmitter, event: RunEvent): void {
  emitter.emit('event', event);
}

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

async function runOneUi(
  runId: string,
  browser: Browser,
  item: RunnableTestCase,
  index: number,
  totalTests: number,
  emitter: EventEmitter,
  budget: DisambiguationBudget,
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
        let finalExc = exc;
        let disambiguationAttempted = false;

        // Only a strict-mode violation (N>1 matches) is eligible for live disambiguation - a
        // "0 matches" failure is a different, unrelated problem (wrong role/name entirely) that
        // this fallback must not attempt to paper over. navigate steps have no locator at all.
        if (step.kind !== 'navigate') {
          const violation = isStrictModeViolation(exc);
          if (violation) {
            disambiguationAttempted = true;
            const resolved = await disambiguate({
              page,
              locatorSpec: step.locator,
              actionLabel: label,
              stepKind: step.kind,
              matchCount: violation.matchCount,
              budget,
            }).catch((e): DisambiguationResult => ({ ok: false, reason: e instanceof Error ? e.message : String(e) }));

            if (resolved.ok) {
              try {
                const { selectorUsed } = await applyStep(page, step, {
                  locator: resolved.locator,
                  selectorUsed: resolved.selectorUsed,
                });
                steps.push({
                  action: step.kind,
                  label,
                  selectorUsed,
                  outcome: 'pass',
                  disambiguated: true,
                  disambiguationDetail: resolved.selectorUsed,
                });
                emit(emitter, {
                  type: 'step-result',
                  payload: {
                    testId: id,
                    stepIndex,
                    action: step.kind,
                    label,
                    outcome: 'pass',
                    selectorUsed,
                    disambiguated: true,
                    disambiguationDetail: resolved.selectorUsed,
                  },
                });
                continue;
              } catch (postExc) {
                // The disambiguated element still failed - report that (a real failure), not
                // the original strict-mode-violation message.
                finalExc = postExc;
              }
            }
          }
        }

        const message = stripAnsi(finalExc instanceof Error ? finalExc.message : String(finalExc));
        // Screenshot the live page at the moment of failure, before context teardown. Best-effort:
        // a failure here (e.g. the page itself crashed) shouldn't mask the original step error.
        const screenshotBuffer = await page.screenshot().catch(() => undefined);
        const screenshot = screenshotBuffer?.toString('base64');
        const screenshotPath = screenshotBuffer ? saveScreenshotFile(runId, id, stepIndex, screenshotBuffer) : undefined;
        steps.push({
          action: step.kind,
          label,
          outcome: 'fail',
          error: message,
          screenshot,
          screenshotPath,
          disambiguationAttempted: disambiguationAttempted || undefined,
        });
        emit(emitter, {
          type: 'step-result',
          payload: {
            testId: id,
            stepIndex,
            action: step.kind,
            label,
            outcome: 'fail',
            error: message,
            screenshot,
            screenshotPath,
            disambiguationAttempted: disambiguationAttempted || undefined,
          },
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

/** Runs UI and API test cases in order. Never rejects. */
export async function runTestCases(
  runId: string,
  testCases: RunnableTestCase[],
  emitter: EventEmitter,
  opts: RunnerOptions = {},
): Promise<TestReport[]> {
  const headless = opts.headless ?? true;
  const totalTests = testCases.length;
  const budget: DisambiguationBudget = { used: 0, max: opts.maxDisambiguationsPerRun ?? 20 };

  emit(emitter, { type: 'run-start', payload: { runId, totalTests } });

  const reports: TestReport[] = [];
  let browser: Browser | undefined;

  try {
    if (testCases.some((tc) => tc.storyType === 'ui')) {
      browser = await chromium.launch({ headless });
    }

    for (let index = 0; index < testCases.length; index++) {
      const item = testCases[index];
      if (item.storyType === 'api') {
        reports.push(await runOneApi(item.id, item.testCase, index, totalTests, emitter));
      } else {
        reports.push(await runOneUi(runId, browser!, item, index, totalTests, emitter, budget));
      }
    }

    const summary = {
      total: reports.length,
      passed: reports.filter((r) => r.outcome === 'PASS').length,
      failed: reports.filter((r) => r.outcome === 'FAIL').length,
      disambiguatedSteps: reports.reduce(
        (count, r) => count + r.steps.filter((s) => s.disambiguated).length,
        0,
      ),
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
