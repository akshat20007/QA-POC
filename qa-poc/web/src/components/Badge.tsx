import type { ReactNode } from 'react';
import { CheckIcon, XIcon, PendingDotIcon, RunningDotIcon } from './icons';
import type { TestStatus } from '../state/AppStateContext';

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

const PRIORITY_CLASSES: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-slate-100 text-slate-600',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge className={PRIORITY_CLASSES[priority] ?? PRIORITY_CLASSES.low}>{priority}</Badge>;
}

const CATEGORY_CLASSES: Record<string, string> = {
  'happy-path': 'bg-emerald-50 text-emerald-600',
  'edge-case': 'bg-amber-50 text-amber-600',
  negative: 'bg-red-50 text-red-600',
};

export function CategoryBadge({ category }: { category: string }) {
  return <Badge className={CATEGORY_CLASSES[category] ?? CATEGORY_CLASSES['happy-path']}>{category}</Badge>;
}

export function StatusBadge({ status }: { status: TestStatus }) {
  switch (status) {
    case 'pass':
      return (
        <Badge className="bg-emerald-50 text-emerald-600">
          <CheckIcon className="h-3.5 w-3.5" /> PASS
        </Badge>
      );
    case 'fail':
      return (
        <Badge className="bg-red-50 text-red-600">
          <XIcon className="h-3.5 w-3.5" /> FAIL
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-50 text-blue-600">
          <RunningDotIcon /> Running
        </Badge>
      );
    case 'pending':
    default:
      return (
        <Badge className="bg-slate-100 text-slate-500">
          <PendingDotIcon /> Pending
        </Badge>
      );
  }
}

export function StepOutcomeBadge({ outcome }: { outcome: 'pass' | 'fail' }) {
  return outcome === 'pass' ? (
    <Badge className="bg-emerald-50 text-emerald-600">
      <CheckIcon className="h-3.5 w-3.5" /> pass
    </Badge>
  ) : (
    <Badge className="bg-red-50 text-red-600">
      <XIcon className="h-3.5 w-3.5" /> fail
    </Badge>
  );
}

export function WarningBadge({ children }: { children: ReactNode }) {
  return <Badge className="bg-amber-50 text-amber-600">{children}</Badge>;
}
