import type { CheckSummary } from '../api/types';
import { StatusBadge, TypeBadge } from './Badge';
import { Button } from './Button';
import { Card, CardBody } from './Card';
import { RunTimeline } from './RunTimeline';

function formatWhen(iso: string | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDuration(ms: number | undefined) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function CheckCard({
  check,
  onOpen,
  onRun,
}: {
  check: CheckSummary;
  onOpen: () => void;
  onRun: () => void;
}) {
  const stripe = check.type === 'api' ? 'border-l-teal-500' : 'border-l-indigo-500';
  const uptime = check.uptime24h == null ? '—' : `${check.uptime24h}%`;

  return (
    <Card className={`border-l-4 ${stripe}`}>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="text-left">
            <h2 className="text-lg font-semibold text-slate-900 hover:text-indigo-600">{check.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Every {check.intervalMinutes} min</p>
          </button>
          <div className="flex items-center gap-2">
            <TypeBadge type={check.type} />
            <StatusBadge running={check.running} status={check.lastRun?.status ?? null} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <div className="text-slate-400">24h uptime</div>
            <div className="font-semibold text-slate-900">{uptime}</div>
          </div>
          <div>
            <div className="text-slate-400">Last run</div>
            <div className="font-medium text-slate-900">{formatWhen(check.lastRun?.ranAt)}</div>
          </div>
          <div>
            <div className="text-slate-400">Duration</div>
            <div className="font-medium text-slate-900">{formatDuration(check.lastRun?.durationMs)}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Last 24 hours</div>
          <RunTimeline runs={check.history24h ?? []} />
        </div>

        {check.lastRun?.status === 'fail' && check.lastRun.error && (
          <p className="mt-3 truncate font-mono text-xs text-red-600" title={check.lastRun.error}>
            {check.lastRun.error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onOpen}>
            Open
          </Button>
          <Button onClick={onRun} disabled={check.running}>
            {check.running ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
