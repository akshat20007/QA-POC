import type { TimelineRun } from '../api/types';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatAxisDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

function niceMaxDuration(ms: number) {
  if (ms <= 500) return 500;
  if (ms <= 1000) return 1000;
  if (ms <= 5000) return Math.ceil(ms / 1000) * 1000;
  return Math.ceil(ms / 5000) * 5000;
}

function runLabel(run: TimelineRun) {
  return `${run.status === 'pass' ? 'Passed' : 'Failed'} · ${formatWhen(run.ranAt)} · ${formatDuration(run.durationMs)}`;
}

const CHART_WIDTH = 400;
const CHART_HEIGHT = 128;
const PAD = { top: 8, right: 12, bottom: 12, left: 44 };

function pointX(index: number, count: number, plotWidth: number) {
  if (count === 1) return PAD.left + plotWidth / 2;
  return PAD.left + (index / (count - 1)) * plotWidth;
}

function pointY(durationMs: number, maxMs: number, plotHeight: number) {
  return PAD.top + plotHeight - (durationMs / maxMs) * plotHeight;
}

export function RunTimeline({ runs = [] }: { runs?: TimelineRun[] }) {
  const safeRuns = runs ?? [];

  if (safeRuns.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-400"
        role="img"
        aria-label="No runs in the last 24 hours"
      >
        No runs in the last 24 hours
      </div>
    );
  }

  const passed = safeRuns.filter((run) => run.status === 'pass').length;
  const maxMs = niceMaxDuration(Math.max(...safeRuns.map((run) => run.durationMs), 1));
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  const plotWidth = CHART_WIDTH - PAD.left - PAD.right;
  const yTicks = [0, maxMs / 2, maxMs];

  const points = safeRuns.map((run, index) => ({
    x: pointX(index, safeRuns.length, plotWidth),
    y: pointY(run.durationMs, maxMs, plotHeight),
    run,
    index,
  }));

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white p-3 ring-1 ring-inset ring-slate-200/70"
        role="img"
        aria-label={`${safeRuns.length} runs in the last 24 hours, ${passed} passed`}
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-32 w-full">
          {yTicks.map((tick) => {
            const y = PAD.top + plotHeight - (tick / maxMs) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={CHART_WIDTH - PAD.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200"
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px]">
                  {formatAxisDuration(tick)}
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              className="text-indigo-300"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map(({ x, y, run, index }) => {
            const pass = run.status === 'pass';
            return (
              <g key={`${run.ranAt}-${index}`} className="group/point">
                <title>{runLabel(run)}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={5}
                  className={
                    pass
                      ? 'fill-emerald-500 stroke-white group-hover/point:fill-emerald-400'
                      : 'fill-rose-500 stroke-white group-hover/point:fill-rose-400'
                  }
                  strokeWidth={2}
                />
              </g>
            );
          })}

          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={PAD.top + plotHeight}
            stroke="currentColor"
            className="text-slate-300"
          />
          <line
            x1={PAD.left}
            y1={PAD.top + plotHeight}
            x2={CHART_WIDTH - PAD.right}
            y2={PAD.top + plotHeight}
            stroke="currentColor"
            className="text-slate-300"
          />
        </svg>

        <div className="pointer-events-none absolute left-1 top-3 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Duration
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{safeRuns.length} run{safeRuns.length === 1 ? '' : 's'} in last 24h</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {passed} pass
          </span>
          {safeRuns.length - passed > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              {safeRuns.length - passed} fail
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
