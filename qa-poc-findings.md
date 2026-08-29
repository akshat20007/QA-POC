# QA Agent PoC — Findings & Go/No-Go

Phase 5 write-up per `qa-poc-build-spec.md`. Covers all 5 phases; evidence pulled from `qa-poc/output/results.log`, `qa-poc/output/execution-results.log`, and the Phase 3/4 diagnostic runs.

## Success criteria

| Criterion | Result | Evidence |
|---|---|---|
| At least 2/3 test cases pass end-to-end with zero manual selector edits | **PASS** | `login_valid` and `login_invalid` both PASS in `execution-results.log`; no selector was ever hand-edited — all locators came straight from `generate.py`'s output through `translator.ts` |
| Invalid-login case correctly reports FAIL / isn't a false pass | **PASS** | Phase 4's negative control confirmed the error-message locator does *not* match after a genuine valid login, so `login_invalid`'s PASS is trustworthy, not a rubber-stamped assertion |
| JSON output parses cleanly on effectively every generation call | **PASS** | 3/3 valid JSON on every observed `generate.py` run (multiple runs across Phases 1-3) |

All three success criteria are met.

## Findings

**1. Role/text-based locators work reliably for uniquely-identified elements.** Every login-flow field and button (`textbox: Username`, `textbox: Password`, `button: Login`) translated to a correct, unique Playwright locator and executed successfully with zero manual edits, across every run. This is the core positive result: for elements that exist once on the page, the LLM's `target_hint` guesses were consistently accurate and Playwright's `getByRole`/`getByText` resolved them without help.

**2. Selector-guess role is inconsistent across generation runs for the same element.** The Products page title (`<span class="title">Products</span>`, no ARIA role) was hinted differently across separate `generate.py` runs — `"heading: Products"` in one run (which failed: no element on the real page has role `heading` with that name) versus `"text: Products"` / bare `"Products"` in others (which passed, since `getByText` matches it). Same element, same story, different guessed locator strategy from run to run — a consistency problem, not just an accuracy problem.

**3. Selector guessing fails on repeated elements without disambiguating context.** `add_to_cart`'s `target_hint` for "click add to cart button" is the generic `"button: Add to cart"`. The real Sauce Demo inventory page has one such button *per product* (6 total), so `page.getByRole('button', { name: 'Add to cart' })` throws a Playwright strict-mode violation (resolves to 6 elements) rather than picking one. This failed consistently across every run — it's structural, not a fluke: the user story never tells the LLM *which* product to add, so the LLM has no basis to make the hint product-specific.

**4. The translator's fail-loud design caught a bad LLM output correctly.** In one generation run, `add_to_cart`'s "given" precondition step was generated as `{"action": "navigate to login page", "target_hint": "textbox: Username"}` — an invalid pairing (a navigate action with a non-URL hint). `translateTestCase()` correctly surfaced this as a translation error rather than attempting to execute something nonsensical or silently skipping it. This is the intended behavior per the build spec ("don't try to handle arbitrary free text yet") working as designed.

**5. `add_to_cart`'s precondition isn't self-contained.** Its steps assume an already-logged-in session; a fresh browser can't satisfy that from the JSON alone. This was worked around with a narrow, explicitly-hardcoded login step in the runner — acceptable for a 3-fixed-test-case PoC, but would not scale to a general batch runner without a real setup/precondition mechanism.

## Go / No-Go call

**Qualified GO.**

The core hypothesis — an LLM can generate test cases *and* guess selectors accurate enough for Playwright to execute with zero hand-written selectors — holds for the common case: uniquely-identified elements in a standard form/navigation flow (findings 1). Two of three fixed test cases passed end-to-end with no manual intervention, and the one negative case was validated as a trustworthy result, not a false pass.

The weakness is narrow and well-understood, not diffuse: selector guessing degrades specifically on (a) elements whose correct ARIA role isn't obvious or consistent (finding 2), and (b) repeated/list-type elements where the story itself doesn't supply disambiguating context (finding 3). Per the build spec's own decision framework ("selector misses on standard elements → note which elements and why... before deciding whether to pull Playwright MCP forward"), this is exactly the kind of bounded, legible failure mode that justifies pulling **Playwright MCP** forward next — giving the agent a way to inspect the live page and disambiguate — rather than a reason to abandon the static-JSON-schema approach. JSON reliability (finding — success criterion 3) was never in question; the API's native structured-output mode held up across every run.
