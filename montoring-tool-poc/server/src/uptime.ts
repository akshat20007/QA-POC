import type { RunRecord, TimelineRun } from './types.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TIMELINE_RUNS = 48;

export function runsInLast24h(records: RunRecord[], now = Date.now()): RunRecord[] {
  const cutoff = now - WINDOW_MS;
  return records.filter((r) => {
    const ts = Date.parse(r.ranAt);
    return Number.isFinite(ts) && ts >= cutoff && ts <= now;
  });
}

/** Passed / total in the last 24 hours, or null when there are no runs. */
export function uptimePercent(records: RunRecord[], now = Date.now()): number | null {
  const windowed = runsInLast24h(records, now);
  if (windowed.length === 0) return null;
  const passed = windowed.filter((r) => r.status === 'pass').length;
  return Math.round((passed / windowed.length) * 1000) / 10;
}

/** Chronological runs in the last 24h (oldest first), capped for the dashboard timeline. */
export function runTimeline24h(records: RunRecord[], now = Date.now()): TimelineRun[] {
  return runsInLast24h(records, now)
    .sort((a, b) => Date.parse(a.ranAt) - Date.parse(b.ranAt))
    .slice(-MAX_TIMELINE_RUNS)
    .map((record) => ({
      status: record.status,
      ranAt: record.ranAt,
      durationMs: record.durationMs,
    }));
}
