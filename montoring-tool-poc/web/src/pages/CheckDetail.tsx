import { useEffect, useRef, useState } from 'react';
import { getCheck, runCheck, saveCheck } from '../api/client';
import type { CheckDetail } from '../api/types';
import { StatusBadge, TypeBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, CardBody, CardHeader } from '../components/Card';
import { RunTimeline } from '../components/RunTimeline';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function CheckDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [check, setCheck] = useState<CheckDetail | null>(null);
  const [script, setScript] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scriptDirtyRef = useRef(false);
  const intervalDirtyRef = useRef(false);

  async function refresh(opts?: { syncEditor?: boolean }) {
    const data = await getCheck(id);
    setCheck(data);
    if (opts?.syncEditor || !scriptDirtyRef.current) {
      setScript(data.script);
    }
    if (opts?.syncEditor || !intervalDirtyRef.current) {
      setIntervalMinutes(data.intervalMinutes);
    }
  }

  useEffect(() => {
    scriptDirtyRef.current = false;
    intervalDirtyRef.current = false;
    void refresh({ syncEditor: true }).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    const timer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveCheck(id, { script, intervalMinutes });
      scriptDirtyRef.current = false;
      intervalDirtyRef.current = false;
      setNotice('Saved.');
      await refresh({ syncEditor: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    setError(null);
    setNotice(null);
    setCheck((prev) => (prev ? { ...prev, running: true } : prev));
    try {
      const { record } = await runCheck(id);
      setNotice(record.status === 'pass' ? 'Run passed.' : 'Run failed.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refresh();
    }
  }

  if (!check) {
    return <p className="text-sm text-slate-500">Loading check…</p>;
  }

  const uptime = check.uptime24h == null ? '—' : `${check.uptime24h}%`;
  const stripe = check.type === 'api' ? 'border-l-teal-500' : 'border-l-indigo-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Checks
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save script'}
          </Button>
          <Button onClick={() => void handleRun()} disabled={check.running}>
            {check.running ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>
      )}

      <Card className={`border-l-4 ${stripe}`}>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{check.name}</h2>
            <p className="text-sm text-slate-500">{check.scriptPath}</p>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={check.type} />
            <StatusBadge running={check.running} status={check.lastRun?.status ?? null} />
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-slate-400">24h uptime</div>
              <div className="text-lg font-semibold">{uptime}</div>
            </div>
            <label className="block text-sm">
              <span className="text-xs text-slate-400">Interval (minutes)</span>
              <input
                type="number"
                min={1}
                value={intervalMinutes}
                onChange={(e) => {
                  setIntervalMinutes(Number(e.target.value));
                  intervalDirtyRef.current = true;
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <div>
              <div className="text-xs text-slate-400">Last run</div>
              <div className="text-sm font-medium">{check.lastRun ? formatWhen(check.lastRun.ranAt) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Duration</div>
              <div className="text-sm font-medium">
                {check.lastRun ? formatDuration(check.lastRun.durationMs) : '—'}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Last 24 hours</div>
            <RunTimeline runs={check.history24h ?? []} />
          </div>
          {check.lastRun?.error && (
            <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">{check.lastRun.error}</pre>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h3 className="font-semibold text-slate-900">Playwright script</h3>
            <p className="text-xs text-slate-500">
              Default-export <code className="font-mono">async function run</code>
              {check.type === 'api' ? ' ({ request })' : ' ({ page })'}.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <textarea
            value={script}
            onChange={(e) => {
              setScript(e.target.value);
              scriptDirtyRef.current = true;
            }}
            spellCheck={false}
            className="h-80 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Recent runs</h3>
        </CardHeader>
        <CardBody>
          {check.history.length === 0 ? (
            <p className="text-sm text-slate-500">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {check.history.map((row) => (
                <li key={`${row.ranAt}-${row.trigger}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-600">{formatWhen(row.ranAt)}</span>
                  <span className="text-slate-400">{row.trigger}</span>
                  <span className="text-slate-500">{formatDuration(row.durationMs)}</span>
                  <span className={row.status === 'pass' ? 'text-emerald-600' : 'text-red-600'}>{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
