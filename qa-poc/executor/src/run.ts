import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { runTestCases } from './runner.js';
import type { RunnableTestCase } from './runner.js';
import type { TestCase } from './types.js';
import type { TestReport } from './apiTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const RESULTS_LOG = path.join(OUTPUT_DIR, 'execution-results.log');

interface TestFile {
  fileStem: string;
  testCase: TestCase;
}

function loadTestFiles(): TestFile[] {
  return readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const stem = path.basename(f, '.json');
      const parsed = JSON.parse(readFileSync(path.join(OUTPUT_DIR, f), 'utf-8')) as TestCase | TestCase[];
      const testCases = Array.isArray(parsed) ? parsed : [parsed];
      return testCases.map((testCase, i) => ({
        fileStem: testCases.length > 1 ? `${stem}_${i + 1}` : stem,
        testCase,
      }));
    });
}

function formatReport(reports: TestReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    lines.push(`\n=== ${r.id} — ${r.name} ===`);
    lines.push(`Result: ${r.outcome}`);
    for (const s of r.steps) {
      const marker = s.outcome === 'pass' ? '  [pass]' : '  [FAIL]';
      const screenshotNote = s.screenshotPath ? ` — screenshot: ${s.screenshotPath}` : '';
      lines.push(`${marker} ${s.action}${s.selectorUsed ? ` — selector: ${s.selectorUsed}` : ''}${s.error ? ` — ${s.error}` : ''}${screenshotNote}`);
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

  // id === fileStem for CLI runs, so the log's "=== <id> — <name> ===" header matches
  // the pre-refactor "=== <file> — <name> ===" output exactly. Login preconditions are
  // handled by generate.py's ensure_login_precondition, which prepends real login steps
  // to the JSON itself - no separate code-level hook needed here.
  const runnable: RunnableTestCase[] = testFiles.map(({ fileStem, testCase }) => ({
    id: fileStem,
    testCase,
  }));

  const emitter = new EventEmitter();
  const reports = await runTestCases('cli', runnable, emitter, { headless });

  const report = formatReport(reports);
  console.log(report);
  writeFileSync(RESULTS_LOG, report + '\n', 'utf-8');
}

main();
