import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, request as playwrightRequest } from 'playwright';
import type { CheckDef, RunRecord, RunTrigger } from './types.js';
import { PROJECT_ROOT } from './paths.js';

const TIMEOUT_MS = 60_000;

type CheckModule = {
  default?: (ctx: { page?: unknown; request?: unknown }) => Promise<void>;
};

function resolveScript(check: CheckDef): string {
  return path.resolve(PROJECT_ROOT, check.scriptPath);
}

async function loadRunFn(scriptAbs: string): Promise<(ctx: { page?: unknown; request?: unknown }) => Promise<void>> {
  const href = `${pathToFileURL(scriptAbs).href}?t=${Date.now()}`;
  const mod = (await import(href)) as CheckModule;
  if (typeof mod.default !== 'function') {
    throw new Error('Check script must default-export async function run({ page }) or run({ request })');
  }
  return mod.default;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Check timed out after ${ms / 1000}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function executeCheck(check: CheckDef, trigger: RunTrigger): Promise<RunRecord> {
  const started = Date.now();
  const scriptAbs = resolveScript(check);
  let error = '';
  let status: RunRecord['status'] = 'pass';

  try {
    const run = await loadRunFn(scriptAbs);
    if (check.type === 'ui') {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await withTimeout(run({ page }), TIMEOUT_MS);
      } finally {
        await browser.close();
      }
    } else {
      const context = await playwrightRequest.newContext();
      try {
        await withTimeout(run({ request: context }), TIMEOUT_MS);
      } finally {
        await context.dispose();
      }
    }
  } catch (err) {
    status = 'fail';
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    ranAt: new Date().toISOString(),
    checkId: check.id,
    checkName: check.name,
    type: check.type,
    trigger,
    status,
    durationMs: Date.now() - started,
    error,
  };
}
