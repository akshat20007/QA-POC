import { readFile, writeFile } from 'node:fs/promises';
import { CHECKS_JSON } from './paths.js';
import type { CheckDef } from './types.js';

export async function loadChecks(): Promise<CheckDef[]> {
  const raw = await readFile(CHECKS_JSON, 'utf8');
  const parsed = JSON.parse(raw) as CheckDef[];
  if (!Array.isArray(parsed)) {
    throw new Error('checks.json must be an array');
  }
  return parsed;
}

export async function saveChecks(checks: CheckDef[]): Promise<void> {
  await writeFile(CHECKS_JSON, `${JSON.stringify(checks, null, 2)}\n`, 'utf8');
}

export async function getCheck(id: string): Promise<CheckDef | undefined> {
  const checks = await loadChecks();
  return checks.find((c) => c.id === id);
}

export async function updateCheck(
  id: string,
  patch: Partial<Pick<CheckDef, 'intervalMinutes'>>,
): Promise<CheckDef> {
  const checks = await loadChecks();
  const index = checks.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Unknown check: ${id}`);
  }
  if (patch.intervalMinutes !== undefined) {
    if (!Number.isFinite(patch.intervalMinutes) || patch.intervalMinutes < 1) {
      throw new Error('intervalMinutes must be >= 1');
    }
    checks[index] = { ...checks[index], intervalMinutes: Math.round(patch.intervalMinutes) };
  }
  await saveChecks(checks);
  return checks[index];
}
