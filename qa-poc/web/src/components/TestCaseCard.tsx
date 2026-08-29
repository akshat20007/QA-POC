import type { TestCase, TestStep, TranslationError } from '../api/types';
import { Card, CardHeader, CardBody, CardFooter } from './Card';
import { PriorityBadge, CategoryBadge } from './Badge';
import { Button } from './Button';
import { StepEditor } from './StepEditor';

interface Props {
  testCase: TestCase;
  errors: TranslationError[];
  onChange: (testCase: TestCase) => void;
  onDelete: () => void;
}

const NEW_STEP: TestStep = { type: 'when', action: '', target_hint: '' };

export function TestCaseCard({ testCase, errors, onChange, onDelete }: Props) {
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
        </div>
      </CardHeader>

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

      <CardFooter>
        <span className="text-xs text-slate-400">{testCase.steps.length} step(s)</span>
        <Button variant="danger" type="button" onClick={onDelete}>
          Delete test case
        </Button>
      </CardFooter>
    </Card>
  );
}
