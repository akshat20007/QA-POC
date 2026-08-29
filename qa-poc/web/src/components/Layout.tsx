import type { ReactNode } from 'react';
import type { Stage } from '../state/AppStateContext';
import { CheckIcon } from './icons';

const STAGES: Array<{ key: Stage; label: string }> = [
  { key: 'input', label: 'Input' },
  { key: 'review', label: 'Review' },
  { key: 'execution', label: 'Execution' },
  { key: 'report', label: 'Report' },
];

function Stepper({ current }: { current: Stage }) {
  const currentIndex = STAGES.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STAGES.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const isComplete = index < currentIndex;
        return (
          <li key={stage.key} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold
                  ${isCurrent ? 'bg-indigo-600 text-white' : ''}
                  ${isComplete ? 'bg-emerald-600 text-white' : ''}
                  ${!isCurrent && !isComplete ? 'border-2 border-slate-300 text-slate-400' : ''}`}
              >
                {isComplete ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={`text-sm font-medium ${isCurrent ? 'text-indigo-600' : isComplete ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {stage.label}
              </span>
            </div>
            {index < STAGES.length - 1 && <span className="h-px w-6 bg-slate-200 sm:w-10" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Layout({ stage, children }: { stage: Stage; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">QA Agent</h1>
          <p className="mt-1 text-sm text-slate-500">Generate, review, and run Playwright test cases from plain-English user stories.</p>
          <div className="mt-4">
            <Stepper current={stage} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
