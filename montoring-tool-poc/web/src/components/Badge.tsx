import type { ReactNode } from 'react';
import type { CheckType } from '../api/types';
import { CheckIcon, RunningDotIcon, XIcon } from './icons';

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function TypeBadge({ type }: { type: CheckType }) {
  return type === 'api' ? (
    <Badge className="bg-teal-50 text-teal-600">API</Badge>
  ) : (
    <Badge className="bg-indigo-50 text-indigo-600">Browser</Badge>
  );
}

export function StatusBadge({
  running,
  status,
}: {
  running: boolean;
  status: 'pass' | 'fail' | null;
}) {
  if (running) {
    return (
      <Badge className="bg-blue-50 text-blue-600">
        <RunningDotIcon /> Running
      </Badge>
    );
  }
  if (status === 'pass') {
    return (
      <Badge className="bg-emerald-50 text-emerald-600">
        <CheckIcon className="h-3.5 w-3.5" /> Up
      </Badge>
    );
  }
  if (status === 'fail') {
    return (
      <Badge className="bg-red-50 text-red-600">
        <XIcon className="h-3.5 w-3.5" /> Down
      </Badge>
    );
  }
  return <Badge className="bg-slate-100 text-slate-500">Never run</Badge>;
}
