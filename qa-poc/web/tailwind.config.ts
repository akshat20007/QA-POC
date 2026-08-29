import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        status: {
          pending: '#94a3b8',
          'pending-bg': '#f1f5f9',
          running: '#2563eb',
          'running-bg': '#eff6ff',
          pass: '#059669',
          'pass-bg': '#ecfdf5',
          fail: '#dc2626',
          'fail-bg': '#fef2f2',
          warning: '#d97706',
          'warning-bg': '#fffbeb',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
