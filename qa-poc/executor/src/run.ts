import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { translateTestCase } from './translator.js';
import { applyStep, withRetry } from './executor.js';
import type { TestCase } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const RESULTS_LOG = path.join(OUTPUT_DIR, 'execution-results.log');
const BASE_URL = 'https://www.saucedemo.com';
const ACTION_TIMEOUT_MS = 8000;

interface TestFile {
  fileStem: string;
  testCase: TestCase;
}

interface StepReport {
  action: string;
  selectorUsed?: string;
  outcome: 'pass' | 'fail';
  error?: string;
}

interface TestReport {
  name: string;
  file: string;
  outcome: 'PASS' | 'FAIL';
  steps: StepReport[];
  reason?: string;
}

function loadTestFiles(): TestFile[] {
  return readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      fileStem: path.basename(f, '.json'),
      testCase: JSON.parse(readFileSync(path.join(OUTPUT_DIR, f), 'utf-8')) as TestCase,
    }));
}

async function runTestCase(browser: import('playwright').Browser, testFile: TestFile): Promise<TestReport> {
  const { fileStem, testCase } = testFile;
  const { translated, errors } = translateTestCase(testCase);

  if (errors.length > 0) {
    return {
      name: testCase.name,
      file: fileStem,
      outcome: 'FAIL',
      steps: [],
      reason: `Translation failed: ${errors.map((e) => `step ${e.index} ("${e.step.action}"): ${e.message}`).join('; ')}`,
    };
  }

  const context = await browser.newContext({ baseURL: BASE_URL });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  const page = await context.newPage();
  const steps: StepReport[] = [];
  let failReason: string | undefined;

  try {
    // Hardcoded exception: add_to_cart's precondition assumes an already-logged-in
    // session, which the translator can't infer. See Phase 3 plan for rationale.
    if (fileStem === 'add_to_cart') {
      await page.goto('/');
      await page.getByRole('textbox', { name: 'Username' }).fill('standard_user');
      await page.getByRole('textbox', { name: 'Password' }).fill('secret_sauce');
      await page.getByRole('button', { name: 'Login' }).click();
    }

    for (const step of translated) {
      try {
        const { selectorUsed } = await withRetry(() => applyStep(page, step));
        steps.push({ action: step.kind, selectorUsed, outcome: 'pass' });
      } catch (exc) {
        const message = exc instanceof Error ? exc.message : String(exc);
        steps.push({ action: step.kind, outcome: 'fail', error: message });
        failReason = `Step "${step.kind}" failed after retry: ${message}`;
        break;
      }
    }
  } finally {
    await context.close();
  }

  return {
    name: testCase.name,
    file: fileStem,
    outcome: failReason ? 'FAIL' : 'PASS',
    steps,
    reason: failReason,
  };
}

function formatReport(reports: TestReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    lines.push(`\n=== ${r.file} — ${r.name} ===`);
    lines.push(`Result: ${r.outcome}`);
    for (const s of r.steps) {
      const marker = s.outcome === 'pass' ? '  [pass]' : '  [FAIL]';
      lines.push(`${marker} ${s.action}${s.selectorUsed ? ` — selector: ${s.selectorUsed}` : ''}${s.error ? ` — ${s.error}` : ''}`);
    }
    if (r.reason) lines.push(`Reason: ${r.reason}`);
  }
  const passed = reports.filter((r) => r.outcome === 'PASS').length;
  lines.push(`\n=== Summary: ${passed}/${reports.length} test cases PASSED ===`);
  return lines.join('\n');
}

async function main() {
  const testFiles = loadTestFiles();
  if (testFiles.length === 0) {
    console.error(`No test case JSON files found in ${OUTPUT_DIR}. Run generate.py first.`);
    process.exit(1);
  }

  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });

  const reports: TestReport[] = [];
  for (const testFile of testFiles) {
    reports.push(await runTestCase(browser, testFile));
  }

  await browser.close();

  const report = formatReport(reports);
  console.log(report);
  writeFileSync(RESULTS_LOG, report + '\n', 'utf-8');
}

main();
