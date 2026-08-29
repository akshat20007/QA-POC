# QA Agent — Web UI Design System

## Purpose & scope

This is the single source of truth for how the 4-stage QA Agent web flow (Input → Review → Execution → Report) looks and feels. Every token and pattern here maps directly to `tailwind.config.ts` — when you need a color, spacing value, or component style, look here first instead of picking a new one ad hoc. Consult this doc before adding any new page or component so all 4 stages stay visually consistent.

## 1. Design tokens

### Color palette

| Token | Tailwind class base | Hex | Usage |
|---|---|---|---|
| `background` | `bg-slate-50` | `#f8fafc` | Page background |
| `surface` | `bg-white` | `#ffffff` | Cards, panels, inputs |
| `border` | `border-slate-200` | `#e2e8f0` | Default borders/dividers |
| `border-strong` | `border-slate-300` | `#cbd5e1` | Input borders, hover borders |
| `text-primary` | `text-slate-900` | `#0f172a` | Headings, primary body text |
| `text-secondary` | `text-slate-500` | `#64748b` | Meta text, captions, helper text |
| `text-muted` | `text-slate-400` | `#94a3b8` | Placeholder, disabled text |
| `accent` | `bg-indigo-600` / `text-indigo-600` | `#4f46e5` | Primary actions, active stepper state, links |
| `accent-hover` | `bg-indigo-700` | `#4338ca` | Primary button hover |

### Semantic status colors

Every status must be paired with an icon or text label — never color alone (see §6 Accessibility).

| Status | Color token | Hex | Used for |
|---|---|---|---|
| `pending` / `idle` | `slate-400` on `slate-100` | `#94a3b8` / `#f1f5f9` | Not-yet-run test cases/steps |
| `running` | `blue-600` on `blue-50` | `#2563eb` / `#eff6ff` | Currently executing test/step (pairs with a pulsing dot) |
| `pass` | `emerald-600` on `emerald-50` | `#059669` / `#ecfdf5` | Passed test/step |
| `fail` | `red-600` on `red-50` | `#dc2626` / `#fef2f2` | Failed test/step |
| `warning` | `amber-600` on `amber-50` | `#d97706` / `#fffbeb` | Translation/validation errors |

### Priority & category badge colors

| Value | Color |
|---|---|
| Priority: high | `red-600` / `red-50` |
| Priority: medium | `amber-600` / `amber-50` |
| Priority: low | `slate-600` / `slate-100` |
| Category: happy-path | `emerald-600` / `emerald-50` |
| Category: edge-case | `amber-600` / `amber-50` |
| Category: negative | `red-600` / `red-50` |

### Typography scale

Font: Tailwind's default system-ui sans stack (no webfont — zero load cost, native feel).

| Role | Classes |
|---|---|
| Page title | `text-2xl font-bold text-slate-900` |
| Section heading | `text-lg font-semibold text-slate-900` |
| Card title | `text-base font-semibold text-slate-900` |
| Body text | `text-sm text-slate-700` |
| Meta / caption | `text-xs text-slate-500` |
| Monospace (selectors, raw errors) | `font-mono text-xs text-slate-600` |

### Spacing scale

Use Tailwind's default 4px-based scale; standardize on these steps across the app rather than arbitrary values: `2` (0.5rem), `3` (0.75rem), `4` (1rem), `6` (1.5rem), `8` (2rem), `12` (3rem).

### Radius & elevation

- Cards, buttons, inputs: `rounded-lg` (8px).
- Badges/pills: `rounded-full`.
- Default card elevation: `shadow-sm` + `border border-slate-200`.
- Hover/active elevation (interactive cards only): `shadow-md`.

## 2. Layout shell

- Header: app title left-aligned, `border-b border-slate-200`, `bg-white`.
- 4-stage stepper directly under the header: `Input → Review → Execution → Report`, rendered as an ordered list. Current stage: `text-indigo-600 font-semibold` with a filled indigo circle. Completed stages: `text-slate-500` with a filled emerald checkmark circle. Upcoming stages: `text-slate-400` with an empty outline circle. The stepper is a linear indicator, not clickable navigation — this is a guided wizard, not free navigation.
- Content container: `max-w-4xl mx-auto px-6 py-8`.

## 3. Component patterns

### Buttons

| Variant | Classes | Use |
|---|---|---|
| Primary | `bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-4 py-2` | Main forward action per stage (Generate, Approve & Run, Start New Batch) |
| Secondary | `bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium rounded-lg px-4 py-2` | Secondary actions (Add Story, Add Step) |
| Danger | `bg-white border border-red-300 hover:bg-red-50 text-red-600 font-medium rounded-lg px-3 py-1.5` | Delete test case / delete step |
| Ghost | `text-slate-500 hover:text-slate-700 font-medium` | Low-emphasis inline actions |

All buttons: `disabled:opacity-50 disabled:cursor-not-allowed`, `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`.

### Cards

Anatomy: `rounded-lg border border-slate-200 bg-white shadow-sm`. Header (`px-4 py-3 border-b border-slate-200 flex items-center justify-between`), body (`p-4`), optional footer (`px-4 py-3 border-t border-slate-200`).

### Badges

Pill shape: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`, colored per §1's priority/category/status tables (e.g. `bg-emerald-50 text-emerald-600` for a PASS badge).

### Form controls

Text input / textarea / select: `w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`. Error state: `border-red-400 focus:border-red-500 focus:ring-red-500/20`, with an error message below in `text-xs text-red-600 mt-1`.

### Step-list rows (given/when/then)

Each step row: a small type chip (`given`/`when`/`then`, `bg-slate-100 text-slate-600` pill) + the action text + the `target_hint` rendered in monospace + `value` (if present) also in monospace. Editable variant (Review stage) swaps each field for a form control per §3 above, plus a danger-ghost delete-step button. Read-only variant (Execution/Report stages) additionally shows the resolved `selectorUsed` in monospace below the row once known.

### Progress / live indicators

- Running: a small pulsing blue dot (`animate-pulse bg-blue-600 rounded-full h-2 w-2`) next to the `running` badge.
- Pass: emerald checkmark icon + `pass` badge.
- Fail: red X icon + `fail` badge.
- Pending: hollow slate circle + `pending` badge.
- Overall run progress: a thin bar (`h-1.5 rounded-full bg-slate-200` track, `bg-indigo-600` fill) showing tests completed / total.

### Collapsible detail (raw errors)

`<details>` / `<summary>` native element, styled: `summary` as `text-xs text-indigo-600 cursor-pointer select-none` reading "Show full error", contents as a `<pre>` block: `mt-2 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono p-3 overflow-x-auto`.

## 4. Iconography

Hand-rolled inline SVGs only (checkmark, X, spinner/pulse dot, chevron for collapsibles) — no icon library dependency. Keep them small (`h-4 w-4` default), `currentColor` stroke/fill so they inherit their surrounding text color.

## 5. Accessibility notes

- Status is never color-only: every status badge carries a text label (`PASS`/`FAIL`/`Running`/`Pending`), and icons reinforce it further.
- All interactive elements get a visible `focus-visible` outline (see Buttons above; apply the same ring pattern to custom-styled elements).
- The stepper header uses `aria-current="step"` on the active stage.
- Form errors are associated with their field via `aria-describedby`.

## 6. Applying this doc

When adding a new page or component:
1. Reuse an existing pattern from §3 before inventing a new one.
2. Pull colors only from §1's tables — no new hex values inline.
3. Keep status representation consistent with §5 (label + icon, not color alone).
4. If a genuinely new pattern is needed, add it here first, then implement it — this file should never drift behind the actual UI.
