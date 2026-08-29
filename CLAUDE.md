# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A proof-of-concept per `qa-poc-build-spec.md`: prove an LLM can generate test cases *and* guess selectors accurately enough for Playwright to execute them, with zero hand-written selectors, against a real site (Sauce Demo — saucedemo.com). The build spec was the source of truth for the original phase scope; the project has since grown a web UI (below) beyond what that spec called for, so treat this file as authoritative over the build spec where they now disagree.

The PoC is split by phase into separate halves within `qa-poc/`:
- **Generation (Phase 1)** — Python, at the `qa-poc/` root.
- **Translation/execution (Phase 2-3)** — Node/TypeScript, in `qa-poc/executor/`. Runs standalone (CLI) or as an HTTP/SSE API server for the web UI.
- **Web UI (Phase 4)** — Node/TypeScript, in `qa-poc/web/`, a separate npm package (React + Vite + Tailwind). A 4-stage wizard (Input → Review → Execution → Report) that talks to `qa-poc/executor`'s server over HTTP/SSE; it has no direct access to Python or the filesystem.

Do not mix languages within a phase; each phase's code stays in its existing half. `qa-poc/executor` calls out to Python only via `child_process.spawn` (see `generationClient.ts`), never by importing Python code directly.

## Commands

Generation (Python, run from `qa-poc/`):
```
python -m pip install -r requirements.txt
python generate.py
```
Requires `qa-poc/.env` with `GEMINI_API_KEY` (copy from `.env.example`). Reads every `stories/*.txt` file, calls Gemini, and overwrites `output/results.log` with the generated JSON test cases plus a pass/fail summary line. `python generate.py --single` is a second entry point (`main_single()`): reads one ad-hoc story from stdin, writes one JSON line to stdout — this is what the web UI drives (one process per story) rather than the `stories/*.txt` batch flow.

Translator/executor (Node/TS, run from `qa-poc/executor/`):
```
npm install
npm test                      # runs src/translator.test.ts via node:test
npm start                     # CLI: runs every output/*.json against saucedemo.com, writes output/execution-results.log
npm run server                # HTTP/SSE API for the web UI, port 3001 (override with PORT)
npm run server:dev            # same, via `tsx watch` for iterating on server code
npx tsx src/integration-check.ts   # feeds live-generated test cases through the translator, checks for 0 errors
npx tsx src/negative-control.ts    # sanity check that a real failure actually fails (not a false pass)
```

Web UI (Node/TS, run from `qa-poc/web/`; requires the executor's server running on port 3001 — `npm run server` above):
```
npm install
npm run dev       # Vite dev server; proxies /api/* to http://localhost:3001, see vite.config.ts
npm run build     # type-checks (tsc -b) then builds
```

## Architecture

**Data flow (CLI, Phases 1-3):** a plain-English user story (`qa-poc/stories/*.txt`) → `generate.py` calls Gemini with a strict-JSON schema (see `JSON_SCHEMA`/`SYSTEM_PROMPT` in `generate.py`) → a `TestCase` JSON object with `steps[]` (each step: `type` given/when/then, `action` free text, `target_hint`, optional `value` for fills) → written to `output/*.json` → `qa-poc/executor/src/run.ts` loads every file there and runs it via `runner.ts`.

**Data flow (web, Phase 4):** `qa-poc/web` POSTs raw story text to `/api/generate`; `server.ts` calls `generationClient.ts`, which spawns one `python generate.py --single` per story and parses its one-line JSON stdout into the same `TestCase` shape as the CLI path. The user reviews/edits test cases in the browser (validated via `/api/validate`, which just calls `translateTestCase()`), then `/api/runs` hands an approved list to `runner.ts`'s `runTestCases()`, which runs them against one shared headless browser and streams progress over SSE (`/api/runs/:id/events`). `store.ts` holds all run state (`events`, `reports`) **in memory only** — it does not survive a server restart and is never pruned, so don't rely on it across process restarts or for anything long-running.

**Translation** (`qa-poc/executor/src/translator.ts`, shared by both paths): turns each step into a `TranslatedStep` (`navigate` / `click` / `fill` / `select` / `checkVisible` / `checkText`) carrying a `LocatorSpec` (`role` → `page.getByRole()`, or `text` → `page.getByText()`).

**Key fact about the LLM's `action` field:** despite the build spec's intent of a small fixed action vocabulary, live generations produce varied free text (`"click"`, `"fill"`, `"enter"`, `"navigate"`, `"select"`, `"verify"`, `"assert ... visible"`, etc.). `classifyAction()` in `translator.ts` buckets these via **whole-word** keyword matching (not substring — `"selected"` must not match the `select` keyword) into 6 kinds and — deliberately — returns `null`/throws on anything unrecognized rather than guessing. `translateTestCase()` catches per-step errors and returns them alongside successfully translated steps (mirrors `generate.py`'s "don't crash the whole run" pattern), so a single bad step doesn't kill the batch.

**`target_hint` parsing** (`parseTargetHint()` in `translator.ts`): recognized role prefixes are `button:`, `textbox:`, `link:`, `checkbox:`, `heading:`, `radio:`, `combobox:`, `listitem:`, `img:` (a bare role with no `:name` is also accepted, resolving to "the only element with this role on the page"); a `text:` prefix or any unprefixed non-URL string falls back to a text locator. A `url:` prefix or bare `http(s)://` string is only valid on `navigate` steps.

**Login preconditions are now inferred, not hand-wired:** some stories describe a precondition state (e.g. "navigate to products page" assuming an already-logged-in session) rather than a literally executable action from a fresh browser. `generate.py`'s `ensure_login_precondition()` (run for every generated test case, both CLI and web paths) prepends a real, translatable `LOGIN_STEPS` sequence unless `_has_own_login_steps()` finds the test already has its own `fill username` + `fill password` steps (i.e. it's a login test itself). This heuristic lives entirely in `generate.py` — the translator and runner have no login-specific logic and never should; if you find yourself adding a filename- or id-based special case in `run.ts`/`runner.ts` for a precondition, that almost certainly belongs in `ensure_login_precondition` instead, not alongside it (see git history for what happens when both exist at once).

**Out of scope for this PoC** (see `qa-poc-build-spec.md` for the original full list): CI/CD integration, persistent/durable run storage (the in-memory `store.ts` is intentionally throwaway), self-healing selectors, Playwright MCP, hosting/deployment. The build spec also originally excluded a dashboard/UI and any batch runner beyond the 3 fixed stories — Phase 4 (`qa-poc/web`, plus `server.ts`/`runner.ts` accepting arbitrary client-submitted stories and test cases) supersedes that restriction; the 3 files in `qa-poc/stories/` remain the fixed CLI regression set, but the web UI is meant to run arbitrary user-authored stories.

## Secrets

`qa-poc/.env` holds `GEMINI_API_KEY` and is gitignored — never commit it. Both `generate.py` (`load_dotenv()`) and `qa-poc/executor/src/server.ts` (`dotenv.config()`, resolved relative to `__dirname`) read it from that one location; `qa-poc/web` never sees the key directly, only a `geminiKeyConfigured: boolean` from `/api/health`. If a key is ever accidentally committed, it must be rotated in Google AI Studio, not just removed in a follow-up commit (removal alone leaves it in git history).
