"""
Phase 1 - Generation.
Reads plain-English user stories from stories/*.txt, classifies each as UI or API,
sends each to Gemini Flash-Lite, and validates strict JSON matching the test-case schema.
"""

import json
import os
import re
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
UI_CONTEXT_FILE = CONTEXT_DIR / "saucedemo.md"
API_CONTEXT_FILE = CONTEXT_DIR / "reqres.md"

# ANSI colors for CLI output (indigo for UI, teal for API)
COLOR_UI = "\033[38;2;79;70;229m"   # #4f46e5
COLOR_API = "\033[38;2;13;148;136m"  # #0d9488
COLOR_RESET = "\033[0m"

CLASSIFY_PROMPT = """You are a QA test planner. Given a user story, decide whether it describes
UI/browser testing (clicks, pages, forms, visible elements, login flows) or API/HTTP testing
(endpoints, REST calls, status codes, JSON response bodies, headers).

Respond with strict JSON only:
{ "storyType": "ui" | "api", "reason": "one short sentence explaining why" }

Rules:
- "ui" = the story is about interacting with a web page, browser, buttons, forms, navigation.
- "api" = the story is about HTTP requests, REST endpoints, response status/body/header assertions.
- If the story mentions both, pick the primary intent (what is being tested).
"""

CLASSIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "storyType": {"type": "string", "enum": ["ui", "api"]},
        "reason": {"type": "string"},
    },
    "required": ["storyType", "reason"],
}

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

API_SYSTEM_PROMPT_BASE = """You are a senior QA engineer writing precise, executable API test cases from user stories.

Given a user story about HTTP/REST API testing, produce between 5 and 10 test cases as a JSON array
(no markdown fences, no prose, no explanation), each item matching this schema:

{
  "name": "string",
  "priority": "high | medium | low",
  "category": "happy-path | edge-case | negative",
  "steps": [
    { "type": "given | when | then", "action": "string", "target_hint": "string", "value": "string, optional" }
  ]
}

Together, the test cases must cover happy-path, edge-case, and negative scenarios.

Rules (apply to every item in the array):
- Output strict JSON only: a single JSON array, nothing before or after it.
- "steps" must be ordered given -> when -> then.
- For HTTP request steps ("when"): "target_hint" must be the HTTP method and path, e.g. "GET /api/users",
  "POST /api/users", "GET /api/users/2". Include query strings in the path when relevant, e.g.
  "GET /api/users?page=2".
- For request body steps: put JSON body in "value" (e.g. '{"name":"morpheus","job":"leader"}').
- For status assertions ("then"): "target_hint" must be "status: <code>", e.g. "status: 200", "status: 404".
- For JSON body assertions ("then"): "target_hint" must be "json: <path>", e.g. "json: data[0].email",
  "json: data.id", "json: page". Put the expected value in "value" when asserting a specific value.
- For header assertions ("then"): "target_hint" must be "header: <name>", e.g. "header: Content-Type".
  Put expected value in "value" when asserting a specific header value.
- "action" must be short and unambiguous: "send GET request", "send POST request", "assert status code",
  "assert JSON field", "assert response header".
- Use relative paths (e.g. /api/users) — the runner prepends the base URL.
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

API_KEYWORDS = re.compile(
    r"\b(endpoint|http|https|rest|api|json|status code|reqres|get request|post request|"
    r"response body|header|graphql)\b",
    re.IGNORECASE,
)
UI_KEYWORDS = re.compile(
    r"\b(click|button|page|login|form|browser|navigate|visible|playwright|"
    r"textbox|dropdown|cart|inventory)\b",
    re.IGNORECASE,
)


def strip_ansi(text: str) -> str:
    return re.sub(r"\033\[[0-9;]*m", "", text)


def log(message: str, story_type: str | None = None) -> None:
    """Print to terminal (with optional color) and append plain text to results.log."""
    if story_type == "ui":
        colored = f"{COLOR_UI}[UI]{COLOR_RESET} {message}"
    elif story_type == "api":
        colored = f"{COLOR_API}[API]{COLOR_RESET} {message}"
    else:
        colored = message
    print(colored)
    OUTPUT_DIR.mkdir(exist_ok=True)
    plain = strip_ansi(colored)
    with RESULTS_LOG.open("a", encoding="utf-8") as f:
        f.write(plain + "\n")


def load_context(story_type: str) -> str:
    """Load site/API context doc for the given story type. Missing file is not fatal."""
    path = UI_CONTEXT_FILE if story_type == "ui" else API_CONTEXT_FILE
    if not path.exists():
        print(f"WARNING: context file not found at {path}; generating without it.", file=sys.stderr)
        return ""
    return path.read_text(encoding="utf-8")


def build_system_prompt(story_type: str, context: str) -> str:
    base = SYSTEM_PROMPT_BASE if story_type == "ui" else API_SYSTEM_PROMPT_BASE
    if not context:
        return base
    label = "site structure" if story_type == "ui" else "API reference"
    return (
        f"{base}\n\n"
        f"Reference: known {label} (use this to pick accurate target_hints and realistic values):\n"
        f"{context}"
    )


def heuristic_classify(story_text: str) -> str:
    """Fallback keyword-based classification when Gemini JSON fails."""
    api_hits = len(API_KEYWORDS.findall(story_text))
    ui_hits = len(UI_KEYWORDS.findall(story_text))
    if api_hits > ui_hits:
        return "api"
    return "ui"


def classify_story(client: genai.Client, story_text: str) -> str:
    """Classify a user story as 'ui' or 'api' using Gemini, with keyword fallback."""
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=story_text,
            config=types.GenerateContentConfig(
                system_instruction=CLASSIFY_PROMPT,
                response_mime_type="application/json",
                response_schema=CLASSIFY_SCHEMA,
            ),
        )
        parsed = json.loads(response.text)
        story_type = parsed.get("storyType", "")
        if story_type in ("ui", "api"):
            return story_type
    except (genai_errors.APIError, json.JSONDecodeError, KeyError, TypeError):
        pass
    return heuristic_classify(story_text)


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


def post_process_test_cases(test_cases: list[dict], story_type: str) -> list[dict]:
    if story_type == "api":
        return test_cases
    test_cases = [ensure_login_precondition(tc) for tc in test_cases]
    return [fix_navigate_target_hints(tc) for tc in test_cases]


# Sauce Demo requires a logged-in session for every flow except the login flow itself.
LOGIN_STEPS = [
    {"type": "given", "action": "navigate to login page", "target_hint": "url: /"},
    {"type": "given", "action": "fill username", "target_hint": "textbox: Username", "value": "standard_user"},
    {"type": "given", "action": "fill password", "target_hint": "textbox: Password", "value": "secret_sauce"},
    {"type": "given", "action": "click login button", "target_hint": "button: Login"},
]


def _has_own_login_steps(test_case: dict) -> bool:
    def fills(field: str) -> bool:
        return any(
            ("fill" in str(step.get("action", "")).lower() or "enter" in str(step.get("action", "")).lower())
            and field in str(step.get("target_hint", "")).lower()
            for step in test_case.get("steps", [])
        )
    return fills("username") and fills("password")


def ensure_login_precondition(test_case: dict) -> dict:
    if _has_own_login_steps(test_case):
        return test_case
    test_case["steps"] = [dict(step) for step in LOGIN_STEPS] + list(test_case.get("steps", []))
    return test_case


def fix_navigate_target_hints(test_case: dict) -> dict:
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


def process_story(client: genai.Client, story_text: str) -> tuple[str, list[dict]]:
    """Classify, generate, and post-process test cases for one story."""
    story_type = classify_story(client, story_text)
    context = load_context(story_type)
    system_prompt = build_system_prompt(story_type, context)
    test_cases = generate_test_cases(client, story_text, system_prompt)
    test_cases = post_process_test_cases(test_cases, story_type)
    return story_type, test_cases


def main() -> None:
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set. Copy .env.example to .env and add your key.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    OUTPUT_DIR.mkdir(exist_ok=True)
    RESULTS_LOG.write_text("", encoding="utf-8")

    story_files = sorted(STORIES_DIR.glob("*.txt"))
    if not story_files:
        log("No story files found in " + str(STORIES_DIR))
        sys.exit(1)

    passed = 0
    total_test_cases = 0
    for story_file in story_files:
        story_text = story_file.read_text(encoding="utf-8")
        try:
            story_type, test_cases = process_story(client, story_text)
            log(f"\n=== {story_file.name} ({story_type.upper()}) ===", story_type)
            log(f"Generated {len(test_cases)} test cases", story_type)
            log(json.dumps(test_cases, indent=2), story_type)
            wrapped = {"storyType": story_type, "testCases": test_cases}
            json_path = OUTPUT_DIR / f"{story_file.stem}.json"
            json_path.write_text(json.dumps(wrapped, indent=2), encoding="utf-8")
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
    """Web-UI entry point: reads one story from stdin, writes one JSON line to stdout."""
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(json.dumps({"ok": False, "error": "GEMINI_API_KEY not set", "errorType": "missing_key"}))
        return

    story_text = sys.stdin.read()

    try:
        client = genai.Client(api_key=api_key)
        story_type, test_cases = process_story(client, story_text)
        print(json.dumps({"ok": True, "storyType": story_type, "testCases": test_cases}))
    except genai_errors.APIError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "api_error"}))
    except json.JSONDecodeError as exc:
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "json_error"}))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc), "errorType": "unknown"}))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--single":
        main_single()
    else:
        main()
