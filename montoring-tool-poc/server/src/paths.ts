import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** montoring-tool-poc/ */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const CHECKS_DIR = path.join(PROJECT_ROOT, 'checks');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const RUNS_XLSX = path.join(DATA_DIR, 'runs.xlsx');
export const CHECKS_JSON = path.join(__dirname, 'checks.json');
export const ENV_FILE = path.join(PROJECT_ROOT, '.env');
