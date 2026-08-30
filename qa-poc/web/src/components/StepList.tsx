import type { TestStatus } from '../state/AppStateContext';
import { StepOutcomeBadge } from './Badge';
import { RunningDotIcon } from './icons';

export interface DisplayStep {
  stepIndex: number;
  action: string;
  label: string;
  outcome: 'pass' | 'fail';
  selectorUsed?: string;
  error?: string;
  screenshot?: string;
}

/** Read-only step list for the Execution and Report stages (see design.md's step-list row pattern). */
export function StepList({ steps, status }: { steps: DisplayStep[]; status?: TestStatus }) {
  if (steps.length === 0 && status !== 'running') {
    return <p className="text-xs text-slate-400">Not started yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <li key={step.stepIndex} className="rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-700">{step.label}</span>
            <StepOutcomeBadge outcome={step.outcome} />
          </div>
          {step.selectorUsed && (
            <p className="mt-1 truncate font-mono text-xs text-slate-500" title={step.selectorUsed}>
              {step.selectorUsed}
            </p>
          )}
          {step.error && (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs text-indigo-600">Show full error</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
                {step.error}
              </pre>
            </details>
          )}
          {step.screenshot && (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs text-indigo-600">Show screenshot at failure</summary>
              <img
                src={`data:image/png;base64,${step.screenshot}`}
                alt={`Page state when "${step.label}" failed`}
                className="mt-2 w-full rounded-lg border border-slate-200"
              />
            </details>
          )}
        </li>
      ))}
      {status === 'running' && (
        <li className="flex items-center gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-2.5 text-xs text-blue-600">
          <RunningDotIcon /> Running next step…
        </li>
      )}
    </ul>
  );
}
