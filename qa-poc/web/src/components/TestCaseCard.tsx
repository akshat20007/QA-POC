import { useState } from 'react';
import type { TestCase, TestStep, TranslationError } from '../api/types';
import { Card, CardHeader, CardBody, CardFooter } from './Card';
import { PriorityBadge, CategoryBadge, WarningBadge } from './Badge';
import { Button } from './Button';
import { StepEditor } from './StepEditor';
import { ChevronIcon } from './icons';

interface Props {
  testCase: TestCase;
  errors: TranslationError[];
  onChange: (testCase: TestCase) => void;
  onDelete: () => void;
}

const NEW_STEP: TestStep = { type: 'when', action: '', target_hint: '' };

export function TestCaseCard({ testCase, errors, onChange, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = expanded || errors.length > 0;

  function updateStep(index: number, step: TestStep) {
    const steps = [...testCase.steps];
    steps[index] = step;
    onChange({ ...testCase, steps });
  }

  function deleteStep(index: number) {
    onChange({ ...testCase, steps: testCase.steps.filter((_, i) => i !== index) });
  }

  function addStep() {
    onChange({ ...testCase, steps: [...testCase.steps, { ...NEW_STEP }] });
  }

  const errorByIndex = new Map(errors.map((e) => [e.index, e]));

  return (
    <Card>
      <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse test case' : 'Expand test case'}
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:max-w-xs"
          value={testCase.name}
          onChange={(e) => onChange({ ...testCase, name: e.target.value })}
          placeholder="Test case name"
        />
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            value={testCase.priority}
            onChange={(e) => onChange({ ...testCase, priority: e.target.value as TestCase['priority'] })}
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            value={testCase.category}
            onChange={(e) => onChange({ ...testCase, category: e.target.value as TestCase['category'] })}
          >
            <option value="happy-path">happy-path</option>
            <option value="edge-case">edge-case</option>
            <option value="negative">negative</option>
          </select>
          <PriorityBadge priority={testCase.priority} />
          <CategoryBadge category={testCase.category} />
          {errors.length > 0 && <WarningBadge>{errors.length} error(s)</WarningBadge>}
        </div>
      </CardHeader>

      {isOpen && (
        <CardBody className="space-y-2">
          {testCase.steps.map((step, index) => (
            <StepEditor
              key={index}
              step={step}
              error={errorByIndex.get(index)}
              onChange={(s) => updateStep(index, s)}
              onDelete={() => deleteStep(index)}
              canDelete={testCase.steps.length > 1}
            />
          ))}
          <Button variant="secondary" type="button" onClick={addStep}>
            + Add Step
          </Button>
        </CardBody>
      )}

      <CardFooter>
        <span className="text-xs text-slate-400">{testCase.steps.length} step(s)</span>
        <Button variant="danger" type="button" onClick={onDelete}>
          Delete test case
        </Button>
      </CardFooter>
    </Card>
  );
}
