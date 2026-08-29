import { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import type { TranslationError } from '../api/types';
import { TestCaseCard } from '../components/TestCaseCard';
import { Button } from '../components/Button';
import { WarningBadge } from '../components/Badge';
import { validateTestCases, createRun } from '../api/client';

export function ReviewStage() {
  const { state, dispatch } = useAppState();
  const [errorsById, setErrorsById] = useState<Record<string, TranslationError[]>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalErrorCount = Object.values(errorsById).reduce((sum, errs) => sum + errs.length, 0);

  async function handleApproveAndRun() {
    setBusy(true);
    setSubmitError(null);
    try {
      const validation = await validateTestCases(state.testCases);
      const nextErrors: Record<string, TranslationError[]> = {};
      let hasErrors = false;
      for (const result of validation.results) {
        if (result.errors.length > 0) hasErrors = true;
        nextErrors[result.id] = result.errors;
      }
      setErrorsById(nextErrors);

      if (hasErrors) {
        setSubmitError('Fix the highlighted steps before running — a step that fails to translate would fail instantly anyway.');
        return;
      }

      const { runId } = await createRun(state.testCases);
      dispatch({ type: 'START_RUN', runId, testCases: state.testCases });
    } catch (exc) {
      setSubmitError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">2. Review, edit, and approve</h2>
          <p className="mt-1 text-sm text-slate-500">
            Adjust names, priorities, categories, or individual steps. Add a test case manually or remove one you
            don't need, then approve to run them all against the real site.
          </p>
        </div>
        <Button variant="secondary" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'input' })}>
          Back
        </Button>
      </div>

      {state.generationErrors.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-700">
            {state.generationErrors.length} stor{state.generationErrors.length === 1 ? 'y' : 'ies'} failed to generate:
          </p>
          <ul className="space-y-1 text-xs text-amber-700">
            {state.generationErrors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">Story {e.storyIndex + 1}:</span> {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.testCases.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No test cases yet. Add one manually below, or go back and try generating again.
        </p>
      )}

      <div className="space-y-4">
        {state.testCases.map(({ id, testCase }) => (
          <TestCaseCard
            key={id}
            testCase={testCase}
            errors={errorsById[id] ?? []}
            onChange={(next) => dispatch({ type: 'UPDATE_TEST_CASE', id, testCase: next })}
            onDelete={() => dispatch({ type: 'DELETE_TEST_CASE', id })}
          />
        ))}
      </div>

      <Button variant="secondary" type="button" onClick={() => dispatch({ type: 'ADD_TEST_CASE' })}>
        + Add Test Case
      </Button>

      {totalErrorCount > 0 && <WarningBadge>{totalErrorCount} unresolved step error(s)</WarningBadge>}
      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleApproveAndRun} disabled={busy || state.testCases.length === 0}>
          {busy ? 'Checking…' : 'Approve & Run'}
        </Button>
      </div>
    </div>
  );
}
