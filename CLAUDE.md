# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A proof-of-concept per `qa-poc-build-spec.md`: prove an LLM can generate test cases *and* guess selectors accurately enough for Playwright to execute them, with zero hand-written selectors, against a real site (Sauce Demo — saucedemo.com). The build spec is the source of truth for phase scope — read it before extending any phase.

The PoC is split by phase into two languages within `qa-poc/`:
- **Generation (Phase 1)** — Python, at the `qa-poc/` root.
- **Translation/execution (Phase 2+)** — Node/TypeScript, in `qa-poc/executor/`.

Do not mix languages within a phase; each phase's code stays in its existing half.

## Commands

Generation (Python, run from `qa-poc/`):
```
python -m pip install -r requirements.txt
python generate.py
```
Requires `qa-poc/.env` with `GEMINI_API_KEY` (copy from `.env.example`). Reads every `stories/*.txt` file, calls Gemini, and overwrites `output/results.log` with the generated JSON test cases plus a pass/fail summary line.

Translator (Node/TS, run from `qa-poc/executor/`):
```
npm install
npm test                      # runs src/translator.test.ts via node:test
npx tsx src/integration-check.ts   # feeds live-generated test cases through the translator, checks for 0 errors
```

## Architecture

**Data flow:** a plain-English user story (`qa-poc/stories/*.txt`) → `generate.py` calls Gemini with a strict-JSON schema (see `JSON_SCHEMA`/`SYSTEM_PROMPT` in `generate.py`) → a `TestCase` JSON object with `steps[]` (each step: `type` given/when/then, `action` free text, `target_hint`, optional `value` for fills) → `qa-poc/executor/src/translator.ts` turns each step into a `TranslatedStep` (`navigate` / `click` / `fill` / `checkVisible` / `checkText`) carrying a `LocatorSpec` (`role` → `page.getByRole()`, or `text` → `page.getByText()`).

**Key fact about the LLM's `action` field:** despite the build spec's intent of a small fixed action vocabulary, live generations produce varied free text (`"click"`, `"fill"`, `"enter"`, `"navigate"`, `"verify"`, `"assert ... visible"`, etc.). `classifyAction()` in `translator.ts` buckets these via keyword matching into 5 kinds and — deliberately — returns `null`/throws on anything unrecognized rather than guessing. `translateTestCase()` catches per-step errors and returns them alongside successfully translated steps (mirrors `generate.py`'s "don't crash the whole run" pattern), so a single bad step doesn't kill the batch.

**`target_hint` parsing** (`parseTargetHint()` in `translator.ts`): recognized role prefixes are `button:`, `textbox:`, `link:`, `checkbox:`; a `text:` prefix or any unprefixed non-URL string falls back to a text locator. A `url:` prefix or bare `http(s)://` string is only valid on `navigate` steps.

**Known gap to account for when extending execution (Phase 3):** some `given` steps describe a precondition state (e.g. "navigate to products page" assuming an already-logged-in session) rather than a literally executable action from a fresh browser. The translator does not infer setup steps like login — that has to be handled explicitly by whatever wires translated steps into a real Playwright run.

**Out of scope for this PoC** (see `qa-poc-build-spec.md` for the full list — do not build these): CI/CD integration, database/persistence, dashboard/UI, self-healing selectors, Playwright MCP, hosting/deployment, and any batch runner beyond the 3 fixed test cases in `qa-poc/stories/`.

## Secrets

`qa-poc/.env` holds `GEMINI_API_KEY` and is gitignored — never commit it. If a key is ever accidentally committed, it must be rotated in Google AI Studio, not just removed in a follow-up commit (removal alone leaves it in git history).
