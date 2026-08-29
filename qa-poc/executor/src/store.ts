import type { EventEmitter } from 'node:events';
import type { RunEvent, TestReport, RunSummary } from './apiTypes.js';

export interface RunState {
  runId: string;
  status: 'running' | 'complete';
  startedAt: string;
  completedAt?: string;
  events: RunEvent[];
  reports: TestReport[];
  summary?: RunSummary;
}

const runs = new Map<string, RunState>();
const emitters = new Map<string, EventEmitter>();

export function createRun(runId: string): RunState {
  const state: RunState = {
    runId,
    status: 'running',
    startedAt: new Date().toISOString(),
    events: [],
    reports: [],
  };
  runs.set(runId, state);
  return state;
}

export function getRun(runId: string): RunState | undefined {
  return runs.get(runId);
}

export function appendEvent(runId: string, event: RunEvent): void {
  runs.get(runId)?.events.push(event);
}

export function completeRun(runId: string, reports: TestReport[], summary: RunSummary): void {
  const state = runs.get(runId);
  if (!state) return;
  state.status = 'complete';
  state.completedAt = new Date().toISOString();
  state.reports = reports;
  state.summary = summary;
}

export function registerEmitter(runId: string, emitter: EventEmitter): void {
  emitters.set(runId, emitter);
}

export function getEmitter(runId: string): EventEmitter | undefined {
  return emitters.get(runId);
}

export function unregisterEmitter(runId: string): void {
  emitters.delete(runId);
}
