import type { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import newman from 'newman';
import { validateApiTestCase, type ApiTranslatedStep } from './apiValidator.js';
import { buildPostmanCollection } from './postmanBuilder.js';
import type { TestCase } from './types.js';
import type { RunEvent, TestReport } from './apiTypes.js';

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://reqres.in';

function emit(emitter: EventEmitter, event: RunEvent): void {
  emitter.emit('event', event);
}

interface NewmanRunOutcome {
  steps: TestReport['steps'];
  failReason?: string;
}

function runCollectionWithNewman(
  collection: ReturnType<typeof buildPostmanCollection>['collection'],
  groups: ReturnType<typeof buildPostmanCollection>['groups'],
  testCase: TestCase,
): Promise<NewmanRunOutcome> {
  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection,
        environment: {
          id: randomUUID(),
          name: 'qa-poc-api-env',
          values: [{ key: 'baseUrl', value: API_BASE_URL, enabled: true }],
        },
        reporters: [],
        bail: true,
      },
      (err, summary) => {
        if (err) {
          reject(err);
          return;
        }

        const steps: TestReport['steps'] = [];
        let failReason: string | undefined;
        const executions = summary.run.executions;

        for (let g = 0; g < groups.length; g++) {
          if (failReason) break;

          const group = groups[g];
          const execution = executions[g];
          const requestLabel = testCase.steps[group.requestStepIndex]?.action ?? group.requestLabel;
          const statusCode = execution?.response?.code;
          const requestDetail =
            statusCode !== undefined
              ? `${group.requestMethod} ${group.requestPath} → ${statusCode}`
              : `${group.requestMethod} ${group.requestPath}`;

          if (!execution || statusCode === undefined) {
            const message = 'HTTP request failed — no response received';
            steps.push({
              action: 'request',
              label: requestLabel,
              selectorUsed: requestDetail,
              outcome: 'fail',
              error: message,
            });
            failReason = `Step "${requestLabel}" failed: ${message}`;
            break;
          }

          steps.push({
            action: 'request',
            label: requestLabel,
            selectorUsed: requestDetail,
            outcome: 'pass',
          });

          for (let a = 0; a < group.assertions.length; a++) {
            const meta = group.assertions[a];
            const label = testCase.steps[meta.stepIndex]?.action ?? meta.label;
            const assertionResult = execution.assertions[a];

            if (!assertionResult || assertionResult.skipped) {
              const message = 'Assertion was skipped — request may have failed before tests ran';
              steps.push({
                action: meta.kind,
                label,
                selectorUsed: meta.detailOnPass,
                outcome: 'fail',
                error: message,
              });
              failReason = `Step "${label}" failed: ${message}`;
              break;
            }

            if (assertionResult.error) {
              const message = assertionResult.error.message ?? assertionResult.error.name;
              steps.push({
                action: meta.kind,
                label,
                selectorUsed: meta.detailOnPass,
                outcome: 'fail',
                error: message,
              });
              failReason = `Step "${label}" failed: ${message}`;
              break;
            }

            steps.push({
              action: meta.kind,
              label,
              selectorUsed: meta.detailOnPass,
              outcome: 'pass',
            });
          }
        }

        resolve({ steps, failReason });
      },
    );
  });
}

export async function runOneApi(
  id: string,
  testCase: TestCase,
  index: number,
  totalTests: number,
  emitter: EventEmitter,
): Promise<TestReport> {
  emit(emitter, { type: 'test-start', payload: { testId: id, name: testCase.name, index, totalTests } });

  const { translated, errors } = validateApiTestCase(testCase);

  if (errors.length > 0) {
    const reason = `Validation failed: ${errors
      .map((e) => `step ${e.index} ("${e.step.action}"): ${e.message}`)
      .join('; ')}`;
    emit(emitter, { type: 'test-end', payload: { testId: id, outcome: 'FAIL', reason } });
    return { id, name: testCase.name, outcome: 'FAIL', steps: [], reason };
  }

  const apiSteps = translated as unknown as ApiTranslatedStep[];
  const { collection, groups } = buildPostmanCollection(testCase, apiSteps, API_BASE_URL);

  if (groups.length === 0) {
    const reason = 'No HTTP request steps found — API test cases must include at least one request step';
    emit(emitter, { type: 'test-end', payload: { testId: id, outcome: 'FAIL', reason } });
    return { id, name: testCase.name, outcome: 'FAIL', steps: [], reason };
  }

  let outcome: NewmanRunOutcome;
  try {
    outcome = await runCollectionWithNewman(collection, groups, testCase);
  } catch (exc) {
    const reason = exc instanceof Error ? exc.message : String(exc);
    emit(emitter, { type: 'test-end', payload: { testId: id, outcome: 'FAIL', reason } });
    return { id, name: testCase.name, outcome: 'FAIL', steps: [], reason };
  }

  let stepIndex = 0;
  for (const step of outcome.steps) {
    emit(emitter, {
      type: 'step-result',
      payload: {
        testId: id,
        stepIndex,
        action: step.action,
        label: step.label,
        outcome: step.outcome,
        selectorUsed: step.selectorUsed,
        error: step.error,
      },
    });
    stepIndex += 1;
    if (step.outcome === 'fail') break;
  }

  const testOutcome: 'PASS' | 'FAIL' = outcome.failReason ? 'FAIL' : 'PASS';
  emit(emitter, { type: 'test-end', payload: { testId: id, outcome: testOutcome, reason: outcome.failReason } });
  return { id, name: testCase.name, outcome: testOutcome, steps: outcome.steps, reason: outcome.failReason };
}
