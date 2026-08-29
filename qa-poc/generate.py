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

SYSTEM_PROMPT = """You are a senior QA engineer writing precise, executable test cases from user stories.

Given a user story, produce exactly one JSON object (no markdown fences, no prose, no explanation)
matching this schema:

{
  "name": "string",
  "priority": "high | medium | low",
  "category": "happy-path | edge-case | negative",
  "steps": [
    { "type": "given | when | then", "action": "string", "target_hint": "visible text or role, e.g. 'button: Login'", "value": "string, only for fill-type actions" }
  ]
}

Rules:
- Output strict JSON only. Nothing before or after the JSON object.
- "steps" must be ordered given -> when -> then, and may include multiple "when"/"then" steps for multi-step flows.
- If the story describes an error/invalid/boundary scenario, set "category" to "negative" or "edge-case"
  accordingly, and include a "then" step that asserts the specific error/failure behavior (not just
  "it fails") - e.g. an error message being visible, or the user remaining on the same page.
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
"""

JSON_SCHEMA = {
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


def log(message: str) -> None:
    print(message)
    OUTPUT_DIR.mkdir(exist_ok=True)
    with RESULTS_LOG.open("a", encoding="utf-8") as f:
        f.write(message + "\n")


def generate_test_case(client: genai.Client, story_text: str) -> dict:
    response = client.models.generate_content(
        model=MODEL,
        contents=story_text,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
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


def main() -> None:
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set. Copy .env.example to .env and add your key.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    OUTPUT_DIR.mkdir(exist_ok=True)
    RESULTS_LOG.write_text("", encoding="utf-8")  # fresh log each run

    story_files = sorted(STORIES_DIR.glob("*.txt"))
    if not story_files:
        log(f"No story files found in {STORIES_DIR}")
        sys.exit(1)

    passed = 0
    for story_file in story_files:
        story_text = story_file.read_text(encoding="utf-8")
        log(f"\n=== {story_file.name} ===")
        try:
            test_case = generate_test_case(client, story_text)
            test_case = ensure_login_precondition(test_case)
            log(json.dumps(test_case, indent=2))
            json_path = OUTPUT_DIR / f"{story_file.stem}.json"
            json_path.write_text(json.dumps(test_case, indent=2), encoding="utf-8")
            passed += 1
        except genai_errors.APIError as exc:
            log(f"FAILED - API/network error (not a JSON problem): {exc}")
        except json.JSONDecodeError as exc:
            log(f"FAILED - model did not return valid JSON: {exc}")

    log(f"\n=== Summary: {passed}/{len(story_files)} stories produced valid JSON ===")


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
        test_case = generate_test_case(client, story_text)
        test_case = ensure_login_precondition(test_case)
        print(json.dumps({"ok": True, "testCase": test_case}))
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
