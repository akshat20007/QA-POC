import { executeCheck } from './runner.js';
import { appendRun, lastRun, readRuns } from './excelStore.js';
import { loadChecks } from './checkRegistry.js';
import type { CheckDef, RunRecord, RunTrigger } from './types.js';

const running = new Set<string>();
let runChain: Promise<unknown> = Promise.resolve();

function serializeRun<T>(fn: () => Promise<T>): Promise<T> {
  const next = runChain.then(fn, fn);
  runChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function isRunning(checkId: string): boolean {
  return running.has(checkId);
}

export function runningIds(): string[] {
  return [...running];
}

export async function runCheck(check: CheckDef, trigger: RunTrigger): Promise<RunRecord> {
  if (running.has(check.id)) {
    throw new Error(`Check "${check.id}" is already running`);
  }

  running.add(check.id);
  try {
    return await serializeRun(async () => {
      const record = await executeCheck(check, trigger);
      await appendRun(record);
      return record;
    });
  } finally {
    running.delete(check.id);
  }
}

const TICK_MS = 30_000;
let ticking = false;

export function startScheduler(): void {
  const tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      let checks: CheckDef[];
      try {
        checks = await loadChecks();
      } catch (err) {
        console.error('scheduler: failed to load checks', err);
        return;
      }

      const records = await readRuns();
      const now = Date.now();

      for (const check of checks) {
        if (!check.enabled || running.has(check.id)) continue;
        const intervalMs = Math.max(1, check.intervalMinutes) * 60_000;
        const prev = lastRun(records, check.id);
        const due = !prev || now - Date.parse(prev.ranAt) >= intervalMs;
        if (!due) continue;

        console.log(`scheduler: running ${check.id}`);
        try {
          await runCheck(check, 'scheduled');
        } catch (err) {
          console.error(`scheduler: ${check.id} failed to start`, err);
        }
      }
    } finally {
      ticking = false;
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, TICK_MS);
}
