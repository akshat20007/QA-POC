import { useState } from 'react';
import { useAppState } from '../state/AppStateContext';
import { StoryInputList } from '../components/StoryInputList';
import { Button } from '../components/Button';
import { generateTestCases } from '../api/client';

export function InputStage() {
  const { state, dispatch } = useAppState();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const nonEmptyStories = state.stories.map((s) => s.trim()).filter(Boolean);
  const canSubmit = nonEmptyStories.length > 0 && !loading;

  async function handleGenerate() {
    setLoading(true);
    setSubmitError(null);
    try {
      const response = await generateTestCases(nonEmptyStories);
      dispatch({ type: 'GENERATION_COMPLETE', results: response.results });
    } catch (exc) {
      setSubmitError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">1. Describe what you want to test</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter one or more user stories in plain English. Each story produces one generated test case you can review
          and edit before it runs.
        </p>
      </div>

      <StoryInputList stories={state.stories} onChange={(stories) => dispatch({ type: 'SET_STORIES', stories })} />

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleGenerate} disabled={!canSubmit}>
          {loading ? 'Generating…' : 'Generate Test Cases'}
        </Button>
      </div>
    </div>
  );
}
