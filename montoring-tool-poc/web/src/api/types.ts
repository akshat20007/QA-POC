export type CheckType = 'ui' | 'api';
export type RunTrigger = 'scheduled' | 'manual';
export type RunStatus = 'pass' | 'fail';
export interface TimelineRun {
  status: RunStatus;
  ranAt: string;
  durationMs: number;
}

export interface RunRecord {
  ranAt: string;
  checkId: string;
  checkName: string;
  type: CheckType;
  trigger: RunTrigger;
  status: RunStatus;
  durationMs: number;
  error: string;
}

export interface CheckSummary {
  id: string;
  name: string;
  type: CheckType;
  intervalMinutes: number;
  scriptPath: string;
  enabled: boolean;
  lastRun: RunRecord | null;
  uptime24h: number | null;
  history24h: TimelineRun[];
  running: boolean;
}

export interface CheckDetail extends CheckSummary {
  script: string;
  history: RunRecord[];
}
