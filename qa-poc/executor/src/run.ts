import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import pc from 'picocolors';
import { runTestCases } from './runner.js';
import type { RunnableTestCase } from './runner.js';
import type { StoryType, TestCase } from './types.js';
import type { TestReport } from './apiTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const RESULTS_LOG = path.join(OUTPUT_DIR, 'execution-results.log');

interface TestFile {
  fileStem: string;
  storyType: StoryType;
  testCase: TestCase;
}

interface WrappedOutput {
  storyType?: StoryType;
  testCases?: TestCase[];
}

function parseJsonFile(content: string): { storyType: StoryType; testCases: TestCase[] } {
  const parsed = JSON.parse(content) as TestCase[] | TestCase | WrappedOutput;
  if (Array.isArray(parsed)) {
    return { storyType: 'ui', testCases: parsed };
  }
  if ('testCases' in parsed && Array.isArray(parsed.testCases)) {
    return { storyType: parsed.storyType ?? 'ui', testCases: parsed.testCases };
  }
  return { storyType: 'ui', testCases: [parsed as TestCase] };
}

function loadTestFiles(): TestFile[] {
  return readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const stem = path.basename(f, '.json');
      const { storyType, testCases } = parseJsonFile(readFileSync(path.join(OUTPUT_DIR, f), 'utf-8'));
      return testCases.map((testCase, i) => ({
        fileStem: testCases.length > 1 ? `${stem}_${i + 1}` : stem,
        storyType,
        testCase,
      }));
    });
}

function typeColor(storyType: StoryType) {
  return storyType === 'api' ? pc.cyan : pc.magenta;
}

function formatReport(reports: TestReport[], storyTypes: Map<string, StoryType>): string {
  const lines: string[] = [];
  let currentType: StoryType | null = null;

  for (const r of reports) {
    const storyType = storyTypes.get(r.id) ?? 'ui';
    if (storyType !== currentType) {
      currentType = storyType;
      const tag = storyType === 'api' ? '[API]' : '[UI]';
      lines.push(typeColor(storyType)(`\n--- ${tag} ---`));
    }
    lines.push(typeColor(storyType)(`\n=== ${r.id} — ${r.name} ===`));
    lines.push(`Result: ${r.outcome}`);
    for (const s of r.steps) {
      const marker = s.outcome === 'pass' ? '  [pass]' : '  [FAIL]';
      const detail = s.selectorUsed ? ` — ${s.selectorUsed}` : '';
      lines.push(`${marker} ${s.action}${detail}${s.error ? ` — ${s.error}` : ''}`);
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

  const runnable: RunnableTestCase[] = testFiles.map(({ fileStem, storyType, testCase }) => ({
    id: fileStem,
    storyType,
    testCase,
  }));

  const storyTypes = new Map(runnable.map((r) => [r.id, r.storyType]));

  const emitter = new EventEmitter();
  const reports = await runTestCases('cli', runnable, emitter, { headless });

  const report = formatReport(reports, storyTypes);
  console.log(report);
  writeFileSync(RESULTS_LOG, report.replace(/\x1b\[[0-9;]*m/g, '') + '\n', 'utf-8');
}

main();
