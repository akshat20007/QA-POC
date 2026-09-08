import type { TestStep, TranslationError } from '../api/types';
import type { StoryType } from '../api/types';
import { Button } from './Button';
import { accentFor } from '../theme/storyAccent';

interface Props {
  step: TestStep;
  storyType: StoryType;
  error?: TranslationError;
  onChange: (step: TestStep) => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function ApiRequestEditor({ step, storyType, error, onChange, onDelete, canDelete }: Props) {
  const hasError = Boolean(error);
  const errorId = hasError ? `api-step-error-${step.action}` : undefined;
  const accent = accentFor(storyType);
  const inputClasses = `w-full rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 ${accent.focusRing}`;

  return (
    <div className={`rounded-lg border p-3 ${hasError ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[5rem_1fr] sm:items-start">
        <select
          className={`${inputClasses} border-slate-300`}
          value={step.type}
          onChange={(e) => onChange({ ...step, type: e.target.value as TestStep['type'] })}
        >
          <option value="given">given</option>
          <option value="when">when</option>
          <option value="then">then</option>
        </select>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Action</label>
            <input
              className={`${inputClasses} ${hasError ? 'border-red-400' : 'border-slate-300'}`}
              value={step.action}
              onChange={(e) => onChange({ ...step, action: e.target.value })}
              aria-describedby={errorId}
              placeholder="e.g. send GET request"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Target hint</label>
            <input
              className={`${inputClasses} font-mono ${hasError ? 'border-red-400' : 'border-slate-300'}`}
              value={step.target_hint}
              onChange={(e) => onChange({ ...step, target_hint: e.target.value })}
              aria-describedby={errorId}
              placeholder="e.g. GET /api/users or status: 200"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Value (request body or expected value)</label>
            <input
              className={`${inputClasses} border-slate-300`}
              value={step.value ?? ''}
              onChange={(e) => onChange({ ...step, value: e.target.value || undefined })}
              placeholder="optional"
            />
          </div>
        </div>
      </div>

      {hasError && (
        <p id={errorId} className="mt-2 text-xs text-red-600">
          {error!.message}
        </p>
      )}

      <div className="mt-2 flex justify-end">
        <Button variant="danger" type="button" onClick={onDelete} disabled={!canDelete}>
          Delete step
        </Button>
      </div>
    </div>
  );
}
