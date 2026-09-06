import { useEffect, useState } from 'react';
import { listChecks, runCheck } from '../api/client';
import type { CheckSummary } from '../api/types';
import { CheckCard } from '../components/CheckCard';

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const [checks, setChecks] = useState<CheckSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await listChecks();
      setChecks(data.checks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  async function handleRun(id: string) {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, running: true } : c)));
    try {
      await runCheck(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await refresh();
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading checks…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {checks.map((check) => (
        <CheckCard
          key={check.id}
          check={check}
          onOpen={() => onOpen(check.id)}
          onRun={() => {
            void handleRun(check.id);
          }}
        />
      ))}
    </div>
  );
}
