import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestCase } from './types.js';
import type { GenerationErrorType } from './apiTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QA_POC_ROOT = path.join(__dirname, '..', '..');
const GENERATE_PY = path.join(QA_POC_ROOT, 'generate.py');
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python';
const TIMEOUT_MS = 30_000;

export type GenerationOutcome =
  | { ok: true; testCases: TestCase[] }
  | { ok: false; error: string; errorType: GenerationErrorType };

interface SingleModeStdout {
  ok: boolean;
  testCases?: TestCase[];
  error?: string;
  errorType?: GenerationErrorType;
}

/** Spawns `python generate.py --single`, feeds it one story on stdin, parses its one-line JSON stdout. */
export function generateOne(storyText: string): Promise<GenerationOutcome> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, [GENERATE_PY, '--single'], { cwd: QA_POC_ROOT });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve({ ok: false, error: `generate.py --single timed out after ${TIMEOUT_MS}ms`, errorType: 'timeout' });
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (exc) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: `Failed to spawn python: ${exc.message}`, errorType: 'unknown' });
    });

    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const line = stdout.trim().split('\n').pop() ?? '';
      try {
        const parsed = JSON.parse(line) as SingleModeStdout;
        if (parsed.ok && parsed.testCases) {
          resolve({ ok: true, testCases: parsed.testCases });
        } else {
          resolve({
            ok: false,
            error: parsed.error ?? 'generate.py reported failure with no message',
            errorType: parsed.errorType ?? 'unknown',
          });
        }
      } catch {
        resolve({
          ok: false,
          error: `Could not parse generate.py output as JSON. stdout: ${stdout.slice(0, 500)} stderr: ${stderr.slice(0, 500)}`,
          errorType: 'node_parse_error',
        });
      }
    });

    child.stdin.write(storyText);
    child.stdin.end();
  });
}
