import { useEffect, useState } from 'react';
import { useAppState, resetSession } from './state/AppStateContext';
import { Layout } from './components/Layout';
import { InputStage } from './pages/InputStage';
import { ReviewStage } from './pages/ReviewStage';
import { ExecutionStage } from './pages/ExecutionStage';
import { ReportStage } from './pages/ReportStage';
import { getHealth, getRunReport, ApiError } from './api/client';

export default function App() {
  const { state, dispatch } = useAppState();
  const [keyMissing, setKeyMissing] = useState(false);

  useEffect(() => {
    getHealth()
      .then((health) => setKeyMissing(!health.geminiKeyConfigured))
      .catch(() => setKeyMissing(false));
  }, []);

  // Reconcile a hydrated runId against the server on first load (e.g. after a page
  // refresh): the run may have finished, still be running, or no longer exist if the
  // server restarted (runs are in-memory only).
  useEffect(() => {
    if (!state.runId || (state.stage !== 'execution' && state.stage !== 'report')) return;
    getRunReport(state.runId)
      .then((report) => {
        if (report.status === 'complete') {
          dispatch({ type: 'SET_REPORT', report });
        } else if (state.stage !== 'execution') {
          dispatch({ type: 'SET_STAGE', stage: 'execution' });
        }
      })
      .catch((exc) => {
        // Only a 404 means the run is actually gone (server restarted - runs are in-memory
        // only); any other failure is likely transient, so leave the session intact rather
        // than discarding the user's reviewed stories/test cases over a network blip.
        if (exc instanceof ApiError && exc.status === 404) {
          resetSession();
          dispatch({ type: 'RESET' });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout stage={state.stage}>
      {keyMissing && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          GEMINI_API_KEY is not configured on the server — generation requests will fail until it's set in{' '}
          <code className="font-mono">qa-poc/.env</code>.
        </div>
      )}
      {state.stage === 'input' && <InputStage />}
      {state.stage === 'review' && <ReviewStage />}
      {state.stage === 'execution' && <ExecutionStage />}
      {state.stage === 'report' && <ReportStage />}
    </Layout>
  );
}
