import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_ROOT } from './paths.js';
import type { CheckDef } from './types.js';

export function scriptAbsPath(check: CheckDef): string {
  return path.resolve(PROJECT_ROOT, check.scriptPath);
}

export async function readScript(check: CheckDef): Promise<string> {
  return readFile(scriptAbsPath(check), 'utf8');
}

export async function writeScript(check: CheckDef, script: string): Promise<void> {
  await writeFile(scriptAbsPath(check), script, 'utf8');
}
