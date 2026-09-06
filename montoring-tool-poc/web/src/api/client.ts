import type { CheckDetail, CheckSummary, RunRecord } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as { error?: string } & T) : ({} as T);
  if (!res.ok) {
    const message = (body as { error?: string }).error ?? res.statusText;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export function listChecks() {
  return request<{ checks: CheckSummary[] }>('/api/checks');
}

export function getCheck(id: string) {
  return request<CheckDetail>(`/api/checks/${id}`);
}

export function saveCheck(id: string, body: { script?: string; intervalMinutes?: number }) {
  return request<{ ok: boolean }>(`/api/checks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function runCheck(id: string) {
  return request<{ record: RunRecord }>(`/api/checks/${id}/run`, { method: 'POST' });
}

export function getHealth() {
  return request<{ ok: boolean; running: string[]; note: string }>('/api/health');
}
