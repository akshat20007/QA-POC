import type {
  HealthResponse,
  GenerateResponse,
  IdentifiedTestCase,
  ValidateResponse,
  CreateRunResponse,
  RunReportResponse,
  RunEvent,
} from './types';

/** Thrown for any non-2xx API response; carries the HTTP status so callers can distinguish
 * e.g. a 404 ("this run no longer exists") from a transient network/server error. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(payload.error ?? `Request to ${url} failed with status ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getJson<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function getHealth(): Promise<HealthResponse> {
  return getJson('/api/health');
}

export function generateTestCases(stories: string[]): Promise<GenerateResponse> {
  return postJson('/api/generate', { stories });
}

export function validateTestCases(testCases: IdentifiedTestCase[]): Promise<ValidateResponse> {
  return postJson('/api/validate', { testCases });
}

export function createRun(testCases: IdentifiedTestCase[]): Promise<CreateRunResponse> {
  return postJson('/api/runs', { testCases });
}

export function getRunReport(runId: string): Promise<RunReportResponse> {
  return getJson(`/api/runs/${runId}/report`);
}

/** Fetches a run's report, waiting for the server to actually finish processing it.
 * The server emits its 'run-complete' SSE event, then closes the browser, and only after
 * that marks the run's stored status as 'complete' - a report fetched in that (real, if
 * short) gap comes back with status: 'running' and no reports/summary yet. */
export async function getCompletedRunReport(
  runId: string,
  maxAttempts = 10,
  delayMs = 300,
): Promise<RunReportResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const report = await getRunReport(runId);
    if (report.status === 'complete') return report;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('Run report did not become available in time.');
}

const RUN_EVENT_TYPES: RunEvent['type'][] = [
  'run-start',
  'test-start',
  'step-result',
  'test-end',
  'run-complete',
  'error',
];

/** Opens an SSE connection for a run; caller is responsible for closing the returned EventSource. */
export function subscribeToRunEvents(runId: string, onEvent: (event: RunEvent) => void): EventSource {
  const source = new EventSource(`/api/runs/${runId}/events`);
  for (const type of RUN_EVENT_TYPES) {
    source.addEventListener(type, (evt) => {
      const messageEvent = evt as MessageEvent<string>;
      // A browser-level transport error also dispatches an event named 'error' with no
      // `data` (a plain Event, not a MessageEvent) - only handle ones the server actually sent.
      if (typeof messageEvent.data !== 'string') return;
      onEvent({ type, payload: JSON.parse(messageEvent.data) } as RunEvent);
    });
  }
  // onerror fires on every dropped connection, including transient ones EventSource will
  // silently retry on its own (readyState goes to CONNECTING, not CLOSED). Only treat it as
  // fatal once the browser itself has given up (e.g. the server restarted and a reconnect
  // got a 404, which isn't a valid event-stream response) - otherwise let it keep retrying.
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) {
      onEvent({ type: 'error', payload: { message: 'Lost connection to the run.' } });
    }
  };
  return source;
}
