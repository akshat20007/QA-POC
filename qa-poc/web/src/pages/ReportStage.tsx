import { useEffect, useState } from 'react';
import { useAppState, resetSession } from '../state/AppStateContext';
import { ReportView } from '../components/ReportView';
import { Button } from '../components/Button';
import { getCompletedRunReport } from '../api/client';

export function ReportStage() {
  const { state, dispatch } = useAppState();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (state.report || !state.runId) return;
    getCompletedRunReport(state.runId)
      .then((report) => dispatch({ type: 'SET_REPORT', report }))
      .catch((exc) => setLoadError(exc instanceof Error ? exc.message : String(exc)));
  }, [state.report, state.runId, dispatch]);

  function handleStartNewBatch() {
    resetSession();
    dispatch({ type: 'RESET' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">4. Report</h2>
          <p className="mt-1 text-sm text-slate-500">Here's what happened when each test case ran.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}>
            Back
          </Button>
          <Button variant="secondary" onClick={handleStartNewBatch}>
            Start New Batch
          </Button>
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{loadError}</p>
      )}
      {!state.report && !loadError && <p className="text-sm text-slate-500">Loading report…</p>}
      {state.report && <ReportView report={state.report} testCases={state.testCases} />}
    </div>
  );
}
