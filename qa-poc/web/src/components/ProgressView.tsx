import type { LiveTestProgress } from '../state/AppStateContext';
import type { IdentifiedTestCase, StoryType } from '../api/types';
import { Card, CardHeader, CardBody } from './Card';
import { StatusBadge, StoryTypeBadge } from './Badge';
import { StepList } from './StepList';
import { accentFor } from '../theme/storyAccent';

interface Props {
  testOrder: string[];
  liveProgress: Record<string, LiveTestProgress>;
  testCases: IdentifiedTestCase[];
}

export function ProgressView({ testOrder, liveProgress, testCases }: Props) {
  const storyTypeById = new Map(testCases.map((tc) => [tc.id, tc.storyType]));
  const tests = testOrder.map((id) => liveProgress[id]).filter((t): t is LiveTestProgress => Boolean(t));
  const completed = tests.filter((t) => t.status === 'pass' || t.status === 'fail').length;
  const total = tests.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>
            {completed} / {total} test cases complete
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {tests.map((test) => {
        const storyType: StoryType = storyTypeById.get(test.id) ?? 'ui';
        const accent = accentFor(storyType);
        return (
          <Card key={test.id} className={accent.stripe}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{test.name}</h3>
                <StoryTypeBadge storyType={storyType} />
              </div>
              <StatusBadge status={test.status} />
            </CardHeader>
            <CardBody>
              <StepList steps={test.steps} status={test.status} storyType={storyType} />
              {test.reason && test.status === 'fail' && (
                <p className="mt-3 text-xs text-red-600">{test.reason}</p>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
