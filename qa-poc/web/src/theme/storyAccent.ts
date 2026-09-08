import type { StoryType } from '../api/types';

export const STORY_ACCENT = {
  ui: {
    badge: 'bg-indigo-50 text-indigo-600',
    border: 'border-l-indigo-500',
    groupBg: 'bg-indigo-50/50 border-indigo-200',
    focusRing: 'focus:ring-indigo-500/20',
    stripe: 'border-l-4 border-l-indigo-500',
  },
  api: {
    badge: 'bg-teal-50 text-teal-600',
    border: 'border-l-teal-500',
    groupBg: 'bg-teal-50/50 border-teal-200',
    focusRing: 'focus:ring-teal-500/20',
    stripe: 'border-l-4 border-l-teal-500',
  },
} as const;

export function accentFor(storyType: StoryType) {
  return STORY_ACCENT[storyType];
}
