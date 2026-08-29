import { useEffect } from 'react';
import { useAppState } from '../state/AppStateContext';
import { ProgressView } from '../components/ProgressView';
import { Button } from '../components/Button';
import { subscribeToRunEvents, getCompletedRunReport } from '../api/client';

export function ExecutionStage() {
  const { state, dispatch } = useAppState();
  const { runId } = state;

  useEffect(() => {
    if (state.testOrder.length === 0) {
      dispatch({ type: 'RESUME_RUN' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!runId) return;

    const source = subscribeToRunEvents(runId, (event) => {
      dispatch({ type: 'APPLY_RUN_EVENT', event });
      if (event.type === 'run-complete') {
        source.close();
        getCompletedRunReport(runId)
          .then((report) => dispatch({ type: 'SET_REPORT', report }))
          .catch((exc) => {
            const message = exc instanceof Error ? exc.message : String(exc);
            dispatch({ type: 'APPLY_RUN_EVENT', event: { type: 'error', payload: { message } } });
          });
      }
      if (event.type === 'error') {
        source.close();
      }
    });

    return () => source.close();
  }, [runId, dispatch]);

  if (!runId) {
    return <p className="text-sm text-slate-500">No run in progress.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">3. Execution in progress</h2>
        <p className="mt-1 text-sm text-slate-500">Watching each test case run against the live site in real time.</p>
      </div>
      {state.runError && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>Run stopped: {state.runError}</span>
          <Button variant="secondary" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'review' })}>
            Back to review
          </Button>
        </div>
      )}
      <ProgressView testOrder={state.testOrder} liveProgress={state.liveProgress} />
    </div>
  );
}
