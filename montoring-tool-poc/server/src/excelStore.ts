import { access, mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { DATA_DIR, RUNS_XLSX } from './paths.js';
import type { CheckType, RunRecord, RunStatus, RunTrigger } from './types.js';

const SHEET = 'runs';
const HEADERS = ['ranAt', 'checkId', 'checkName', 'type', 'trigger', 'status', 'durationMs', 'error'] as const;

let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function cellString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
  return String(value);
}

function rowToRecord(row: ExcelJS.Row): RunRecord | null {
  const ranAt = cellString(row.getCell(1).value);
  const checkId = cellString(row.getCell(2).value);
  if (!ranAt || !checkId) return null;
  return {
    ranAt,
    checkId,
    checkName: cellString(row.getCell(3).value),
    type: cellString(row.getCell(4).value) as CheckType,
    trigger: cellString(row.getCell(5).value) as RunTrigger,
    status: cellString(row.getCell(6).value) as RunStatus,
    durationMs: Number(cellString(row.getCell(7).value)) || 0,
    error: cellString(row.getCell(8).value),
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  await mkdir(DATA_DIR, { recursive: true });
  const workbook = new ExcelJS.Workbook();
  if (await fileExists(RUNS_XLSX)) {
    await workbook.xlsx.readFile(RUNS_XLSX);
  } else {
    const sheet = workbook.addWorksheet(SHEET);
    sheet.addRow([...HEADERS]);
    await workbook.xlsx.writeFile(RUNS_XLSX);
  }
  if (!workbook.getWorksheet(SHEET)) {
    const sheet = workbook.addWorksheet(SHEET);
    sheet.addRow([...HEADERS]);
  }
  return workbook;
}

export async function appendRun(record: RunRecord): Promise<void> {
  await serialize(async () => {
    const workbook = await loadWorkbook();
    const sheet = workbook.getWorksheet(SHEET)!;
    sheet.addRow([
      record.ranAt,
      record.checkId,
      record.checkName,
      record.type,
      record.trigger,
      record.status,
      record.durationMs,
      record.error,
    ]);
    await workbook.xlsx.writeFile(RUNS_XLSX);
  });
}

export async function readRuns(): Promise<RunRecord[]> {
  return serialize(async () => {
    const workbook = await loadWorkbook();
    const sheet = workbook.getWorksheet(SHEET)!;
    const records: RunRecord[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = rowToRecord(row);
      if (record) records.push(record);
    });
    return records;
  });
}

export function runsForCheck(records: RunRecord[], checkId: string): RunRecord[] {
  return records.filter((r) => r.checkId === checkId);
}

export function lastRun(records: RunRecord[], checkId: string): RunRecord | null {
  const matching = runsForCheck(records, checkId);
  if (matching.length === 0) return null;
  return matching.reduce((latest, row) => (row.ranAt > latest.ranAt ? row : latest));
}
