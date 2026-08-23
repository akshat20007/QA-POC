# QA Agent — Proof of Concept (Build Spec)

Use this as the project brief in Claude Code. Goal: prove one thing — an LLM can generate test cases AND guess selectors accurately enough for Playwright to execute them, with zero hand-written selectors, against a real site.

Full rationale/criteria: see `qa-poc-report.md`. This file is the build-ready breakdown.

## Out of scope (do not build these yet)
- No CI/CD integration, no GitHub/Jira/Slack
- No database, no persistence
- No dashboard/UI — console output only
- No self-healing, no Playwright MCP
- No hosting/deployment — runs locally
- No batch runner beyond the 3 fixed test cases below

## Target stack
- **Language:** Python for generation, Node/TypeScript for execution (or Python + `playwright` package if you'd rather keep it single-language for a PoC — pick one and don't mix mid-build)
- **LLM:** Gemini Flash-Lite via API, called directly (no LangChain/agent framework)
- **Test runner:** Playwright
- **Test site:** a public test-automation practice site (e.g. Sauce Demo — `saucedemo.com`) — fixed, stable, known target

## Repo structure (suggested)
```
qa-poc/
├── generate.py          # user story -> LLM -> JSON test case
├── translate.py         # JSON test case -> Playwright actions
├── run.py                # orchestrates generate -> translate -> execute -> report
├── stories/
│   ├── login_valid.txt
│   ├── login_invalid.txt
│   └── add_to_cart.txt
├── output/
│   └── results.log       # plain text pass/fail output
├── .env                  # API key, not committed
└── README.md
```

## Task breakdown

### Phase 1 — Generation
- [ ] Write the generation prompt (role: senior QA engineer; output: strict JSON only)
- [ ] JSON schema per test case:
  ```json
  {
    "name": "string",
    "priority": "high | medium | low",
    "category": "happy-path | edge-case | negative",
    "steps": [
      { "type": "given | when | then", "action": "string", "target_hint": "visible text or role, e.g. 'button: Login'" }
    ]
  }
  ```
- [ ] Instruct the model explicitly to include boundary/invalid/error scenarios, not just happy path
- [ ] Write the 3 user stories as plain text input files (see `/stories`)
- [ ] Run generation against all 3, confirm valid JSON comes back every time — log any parse failures
- [ ] **Checkpoint:** all 3 stories produce valid, sensible JSON test cases before moving on

### Phase 2 — Translator
- [ ] Build the function that maps each `steps[]` entry to a Playwright action:
  - `target_hint` → `page.getByRole()` or `page.getByText()` locator (prefer role, fall back to text)
  - `action` → the actual Playwright call (`.click()`, `.fill()`, `.check()`, etc. — map a small fixed vocabulary of actions, don't try to handle arbitrary free text yet)
- [ ] Keep the action vocabulary small and explicit for the PoC: click, fill, check visibility, check text content — resist the urge to generalize this yet
- [ ] Unit-test the translator against a couple of hand-written JSON examples before wiring it to live LLM output

### Phase 3 — Execution
- [ ] Wire translator output into a running Playwright script against the real test site
- [ ] Get the happy-path login case passing end to end, fully automated
- [ ] Get the multi-step add-to-cart case passing end to end
- [ ] Basic retry (1 retry on locator-not-found) is fine — no self-healing logic

### Phase 4 — Negative case validation
- [ ] Run the invalid-login case
- [ ] Confirm it's reported as **FAIL**, not a false pass — this is the case most likely to expose a bad selector guess silently matching the wrong element
- [ ] If it false-passes, that's a real finding — write down exactly what happened before fixing it

### Phase 5 — Report output & findings
- [ ] Console/log output: test name, pass/fail, and which selector was actually used (for debugging selector-guess accuracy)
- [ ] Write up findings against the success criteria below
- [ ] Make the go/no-go call

## Success criteria (from the PoC report — copy here for quick reference)
- [ ] At least 2 of 3 test cases pass end-to-end with zero manual selector edits
- [ ] Invalid-login case correctly reports FAIL
- [ ] JSON output parses cleanly on effectively every generation call

## If it doesn't hold up
- Selector misses on standard elements → note which elements and why (missing accessible role? ambiguous text?) before deciding whether to pull Playwright MCP forward
- JSON breaks often → check if the API's native structured-output/JSON mode is being used; tighten there first
