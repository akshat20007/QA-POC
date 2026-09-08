import type { IdentifiedTestCase } from '../api/types';
import type { RunReportResponse } from '../api/types';
import { Card, CardHeader, CardBody } from './Card';
import { PriorityBadge, CategoryBadge, StepOutcomeBadge, StoryTypeBadge } from './Badge';
import { CheckIcon, XIcon } from './icons';
import { accentFor } from '../theme/storyAccent';

function humanizeReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (reason.includes('strict mode violation')) {
    return 'Multiple matching elements were found on the page — the selector was ambiguous (e.g. a button that appears once per item in a list).';
  }
  if (reason.includes('Translation failed') || reason.includes('Validation failed')) {
    return 'One of the steps could not be translated — see the step detail below.';
  }
  if (reason.toLowerCase().includes('timeout')) {
    return 'The expected element never appeared in time — it may not exist on the page, or a previous step left the page in an unexpected state.';
  }
  return reason;
}

export function ReportView({ report, testCases }: { report: RunReportResponse; testCases: IdentifiedTestCase[] }) {
  const metaById = new Map(testCases.map((tc) => [tc.id, tc]));
  const summary = report.summary ?? {
    total: report.reports.length,
    passed: report.reports.filter((r) => r.outcome === 'PASS').length,
    failed: report.reports.filter((r) => r.outcome === 'FAIL').length,
  };

  return (
    <div className="space-y-6">
      <Card className={summary.failed === 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}>
        <CardBody className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              summary.failed === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {summary.failed === 0 ? <CheckIcon className="h-6 w-6" /> : <XIcon className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {summary.passed} / {summary.total} test cases passed
            </p>
            <p className="text-sm text-slate-500">
              {summary.failed === 0
                ? 'All test cases ran successfully end to end.'
                : `${summary.failed} test case(s) failed — see details below.`}
            </p>
          </div>
        </CardBody>
      </Card>

      {report.reports.map((r) => {
        const identified = metaById.get(r.id);
        const meta = identified?.testCase;
        const storyType = identified?.storyType ?? 'ui';
        const accent = accentFor(storyType);
        const detailLabel = storyType === 'api' ? 'HTTP' : 'Selector';

        return (
          <Card key={r.id} className={accent.stripe}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{r.name}</h3>
                <StoryTypeBadge storyType={storyType} />
                {meta && (
                  <>
                    <PriorityBadge priority={meta.priority} />
                    <CategoryBadge category={meta.category} />
                  </>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  r.outcome === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}
              >
                {r.outcome === 'PASS' ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                {r.outcome}
              </span>
            </CardHeader>
            <CardBody>
              {r.reason && (
                <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{humanizeReason(r.reason)}</p>
              )}
              <ul className="space-y-2">
                {r.steps.map((step, index) => (
                  <li key={index} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700">{step.label}</span>
                      <StepOutcomeBadge outcome={step.outcome} />
                    </div>
                    {step.selectorUsed && (
                      <p className="mt-1 truncate font-mono text-xs text-slate-500" title={step.selectorUsed}>
                        {detailLabel}: {step.selectorUsed}
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
              </ul>
            </CardBody>
          </Card>
        );
      })}

      <Card className="border-slate-200 bg-slate-50">
        <CardBody>
          <p className="text-xs text-slate-500">
            <strong className="text-slate-600">Note on preconditions:</strong> UI stories may have login steps prepended
            automatically unless the story handles login itself. API stories run against the configured base URL (default
            ReqRes).
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
