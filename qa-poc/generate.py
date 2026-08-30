"""
Phase 1 - Generation.
Reads plain-English user stories from stories/*.txt, sends each to Gemini
Flash-Lite, and validates that the response is strict JSON matching the
test-case schema defined in qa-poc-build-spec.md.
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

MODEL = "gemini-flash-lite-latest"

STORIES_DIR = Path(__file__).parent / "stories"
OUTPUT_DIR = Path(__file__).parent / "output"
RESULTS_LOG = OUTPUT_DIR / "results.log"
CONTEXT_DIR = Path(__file__).parent / "context"
SITE_CONTEXT_FILE = CONTEXT_DIR / "saucedemo.md"

SYSTEM_PROMPT_BASE = """You are a senior QA engineer writing precise, executable test cases from user stories.

Given a user story, produce between 5 and 10 test cases as a JSON array (no markdown fences, no prose,
no explanation), each item matching this schema:

{
  "name": "string",
  "priority": "high | medium | low",
  "category": "happy-path | edge-case | negative",
  "steps": [
    { "type": "given | when | then", "action": "string", "target_hint": "visible text or role, e.g. 'button: Login'", "value": "string, only for fill-type actions" }
  ]
}

Together, the test cases in the array must cover:
- The story's acceptance criteria, as one or two "happy-path" cases exercising the normal, intended flow.
- Edge cases around the feature: boundary values, unusual-but-valid input, less common but legitimate
  paths through the flow.
- Negative/invalid cases: bad or missing data, invalid input, error states, and other ways the flow can
  be misused.
Assign each item's own "category" honestly based on what it actually tests - don't force every item to
the same category, and don't pad the array with near-duplicate cases just to hit the count.

Rules (apply to every item in the array):
- Output strict JSON only: a single JSON array, nothing before or after it.
- "steps" must be ordered given -> when -> then, and may include multiple "when"/"then" steps for multi-step flows.
- If a test case covers an error/invalid/boundary scenario, its "category" must be "negative" or
  "edge-case" accordingly, and it must include a "then" step that asserts the specific error/failure
  behavior (not just "it fails") - e.g. an error message being visible, or the user remaining on the
  same page.
- "target_hint" must describe how to locate the element on the page: prefer accessible role plus visible
  text (e.g. "button: Login", "link: Cart", "textbox: Username") since this hint will be used to guess a
  Playwright locator. Fall back to visible text only if no clear role applies.
- "action" must describe what to do in a few words (e.g. "fill username", "click login button",
  "assert error message visible"). Keep it short and unambiguous.
- "value" must be included whenever "action" is a fill-type action (filling in a text field) or a
  select-type action (choosing an option from a dropdown), and must contain the exact realistic data to
  type or the exact visible option text to select, drawn from the story (e.g. "standard_user",
  "secret_sauce", "Price (low to high)"). Omit "value" entirely for other actions (clicks, navigation,
  assertions).
- For a select-type action, "target_hint" must identify the dropdown/combobox itself (e.g. "combobox: Sort
  by"), not the option being chosen - the option text goes in "value".
- For a navigate-type action (going directly to a page by URL, e.g. "navigate to login page"),
  "target_hint" must be a URL: either a full "https://..." URL or a "url: /path" form. Never use a
  role/text hint (like "textbox: Username") for a navigate step - that belongs on the step that
  actually interacts with that element.
"""

TEST_CASE_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
        "category": {"type": "string", "enum": ["happy-path", "edge-case", "negative"]},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["given", "when", "then"]},
                    "action": {"type": "string"},
                    "target_hint": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["type", "action", "target_hint"],
            },
        },
    },
    "required": ["name", "priority", "category", "steps"],
}

JSON_SCHEMA = {
    "type": "array",
    "items": TEST_CASE_SCHEMA,
    "minItems": 5,
    "maxItems": 10,
}


def log(message: str) -> None:
    print(message)
    OUTPUT_DIR.mkdir(exist_ok=True)
    with RESULTS_LOG.open("a", encoding="utf-8") as f:
        f.write(message + "\n")


def load_site_context() -> str:
    """Reads the site-exploration doc (qa-poc/context/saucedemo.md) so target_hints line up
    with real accessible roles/names. Missing file is not fatal - warns and returns ""."""
    if not SITE_CONTEXT_FILE.exists():
        print(f"WARNING: site context file not found at {SITE_CONTEXT_FILE}; "
              f"generating without it.", file=sys.stderr)
        return ""
    return SITE_CONTEXT_FILE.read_text(encoding="utf-8")


def build_system_prompt(site_context: str) -> str:
    """Appends site context (if any) to the base prompt as a labeled reference section."""
    if not site_context:
        return SYSTEM_PROMPT_BASE
    return (
        f"{SYSTEM_PROMPT_BASE}\n\n"
        f"Reference: known site structure (use this to pick accurate target_hints - "
        f"it lists the real accessible roles/names/caveats for this site; if an element "
        f"has no accessible role/name per this reference, fall back to a text hint instead "
        f"of inventing a role):\n{site_context}"
    )


def generate_test_cases(client: genai.Client, story_text: str, system_prompt: str) -> list[dict]:
    response = client.models.generate_content(
        model=MODEL,
        contents=story_text,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=JSON_SCHEMA,
        ),
    )
    return json.loads(response.text)


# Sauce Demo requires a logged-in session for every flow except the login flow itself.
# Rather than trust the LLM to remember this consistently (its target_hint/action wording
# already varies run to run - see qa-poc-findings.md), prepend these deterministically.
LOGIN_STEPS = [
    {"type": "given", "action": "navigate to login page", "target_hint": "url: /"},
    {"type": "given", "action": "fill username", "target_hint": "textbox: Username", "value": "standard_user"},
    {"type": "given", "action": "fill password", "target_hint": "textbox: Password", "value": "secret_sauce"},
    {"type": "given", "action": "click login button", "target_hint": "button: Login"},
]


def _has_own_login_steps(test_case: dict) -> bool:
    """True if the story's own steps already fill in a username and a password -
    i.e. the test is about the login flow itself (e.g. login_valid, login_invalid).

    Requires an actual fill action targeting each field, not just any step whose
    target_hint happens to mention "username"/"password" - an assertion like
    "Username and password do not match" would otherwise be mistaken for a fill.
    Checks the same fill-type verbs translator.ts's classifyAction() does ("fill"
    or "enter"), so a test phrased "enter username" isn't mistaken for one with
    no login steps at all and double-logged-in."""
    def fills(field: str) -> bool:
        return any(
            ("fill" in str(step.get("action", "")).lower() or "enter" in str(step.get("action", "")).lower())
            and field in str(step.get("target_hint", "")).lower()
            for step in test_case.get("steps", [])
        )
    return fills("username") and fills("password")


def ensure_login_precondition(test_case: dict) -> dict:
    """Defaults every generated test case to starting from a logged-in session, unless
    the story's own steps already handle login explicitly (see _has_own_login_steps)."""
    if _has_own_login_steps(test_case):
        return test_case
    test_case["steps"] = [dict(step) for step in LOGIN_STEPS] + list(test_case.get("steps", []))
    return test_case


def fix_navigate_target_hints(test_case: dict) -> dict:
    """Guards against an occasionally-observed model glitch: a navigate step's target_hint
    echoing the *next* step's role/text hint (e.g. "textbox: Username") instead of being a
    URL, which the translator then rejects outright. The prompt now says navigate target_hints
    must be URLs, but that's not a guarantee - so this deterministically corrects the one
    navigate destination this PoC can be certain about: the login page, the only page
    reachable without an existing session. Any other navigate step with a non-URL target_hint
    is left alone rather than guessed at, so it still surfaces as a translation error instead
    of silently pointing somewhere wrong."""
    for step in test_case.get("steps", []):
        action = str(step.get("action", "")).lower()
        words = action.split()
        is_navigate = "navigate" in words or "go" in words
        if not is_navigate or "login" not in action:
            continue
        hint = str(step.get("target_hint", ""))
        looks_like_url = hint.startswith("url:") or hint.startswith("http://") or hint.startswith("https://")
        if not looks_like_url:
            step["target_hint"] = "url: /"
    return test_case


def main() -> None:
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set. Copy .env.example to .env and add your key.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    site_context = load_site_context()
    system_prompt = build_system_prompt(site_context)

    OUTPUT_DIR.mkdir(exist_ok=True)
    RESULTS_LOG.write_text("", encoding="utf-8")  # fresh log each run

    story_files = sorted(STORIES_DIR.glob("*.txt"))
    if not story_files:
        log(f"No story files found in {STORIES_DIR}")
        sys.exit(1)

    passed = 0
    total_test_cases = 0
    for story_file in story_files:
        story_text = story_file.read_text(encoding="utf-8")
        log(f"\n=== {story_file.name} ===")
        try:
            test_cases = generate_test_cases(client, story_text, system_prompt)
            test_cases = [ensure_login_precondition(tc) for tc in test_cases]
            test_cases = [fix_navigate_target_hints(tc) for tc in test_cases]
            log(f"Generated {len(test_cases)} test cases")
            log(json.dumps(test_cases, indent=2))
            json_path = OUTPUT_DIR / f"{story_file.stem}.json"
            json_path.write_text(json.dumps(test_cases, indent=2), encoding="utf-8")
            passed += 1
            total_test_cases += len(test_cases)
        except genai_errors.APIError as exc:
            log(f"FAILED - API/network error (not a JSON problem): {exc}")
        except json.JSONDecodeError as exc:
            log(f"FAILED - model did not return valid JSON: {exc}")

    log(
        f"\n=== Summary: {passed}/{len(story_files)} stories produced valid JSON "
        f"({total_test_cases} total test cases) ==="
    )


def main_single() -> None:
    """Web-UI entry point: reads one story from stdin, writes one JSON line to stdout.

    Kept separate from main() so the CLI batch flow (reads stories/*.txt, writes
    output/*.json + results.log) stays byte-for-byte unchanged.
    """
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(json.dumps({"ok": False, "error": "GEMINI_API_KEY not set", "errorType": "missing_key"}))
        return

    story_text = sys.stdin.read()

    try:
        client = genai.Client(api_key=api_key)
        site_context = load_site_context()
        system_prompt = build_system_prompt(site_context)
        test_cases = generate_test_cases(client, story_text, system_prompt)
        test_cases = [ensure_login_precondition(tc) for tc in test_cases]
        test_cases = [fix_navigate_target_hints(tc) for tc in test_cases]
        print(json.dumps({"ok": True, "testCases": test_cases}))
    except genai_errors.APIError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "api_error"}))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "json_error"}))
    except Exception as exc:  # noqa: BLE001 - last-resort guard so stdout always gets one JSON line
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "unknown"}))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--single":
        main_single()
    else:
        main()
