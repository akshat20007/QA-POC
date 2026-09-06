import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">
            Playwright checks on a 1-hour schedule. Uptime is last-24-hours pass rate and only accumulates while the
            server is running.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
