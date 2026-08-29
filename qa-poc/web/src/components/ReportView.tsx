import type { IdentifiedTestCase } from '../api/types';
import type { RunReportResponse } from '../api/types';
import { Card, CardHeader, CardBody } from './Card';
import { PriorityBadge, CategoryBadge, StepOutcomeBadge } from './Badge';
import { CheckIcon, XIcon } from './icons';

function humanizeReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  if (reason.includes('strict mode violation')) {
    return 'Multiple matching elements were found on the page — the selector was ambiguous (e.g. a button that appears once per item in a list).';
  }
  if (reason.includes('Translation failed')) {
    return 'One of the steps could not be translated into a Playwright action — see the step detail below.';
  }
  if (reason.toLowerCase().includes('timeout')) {
    return 'The expected element never appeared in time — it may not exist on the page, or a previous step left the page in an unexpected state.';
  }
  return reason;
}

export function ReportView({ report, testCases }: { report: RunReportResponse; testCases: IdentifiedTestCase[] }) {
  const metaById = new Map(testCases.map((tc) => [tc.id, tc.testCase]));
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
        const meta = metaById.get(r.id);
        return (
          <Card key={r.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{r.name}</h3>
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
            <strong className="text-slate-600">Note on preconditions:</strong> some stories imply an existing state (e.g.
            "add a product to cart" assumes you're already logged in). Generation automatically prepends a login sequence
            unless the story's own steps already handle login — this heuristic isn't perfect, so a test case may still
            fail here for a reason unrelated to selector accuracy if the wrong precondition was assumed.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
