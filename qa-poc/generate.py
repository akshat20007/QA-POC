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
    { "type": "given | when | then", "action": "string", "target_hint": "visible text or role, e.g. 'button: Login'" }
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
            log(json.dumps(test_case, indent=2))
            passed += 1
        except Exception as exc:  # parse failure or API error
            log(f"FAILED to produce valid JSON: {exc}")

    log(f"\n=== Summary: {passed}/{len(story_files)} stories produced valid JSON ===")


if __name__ == "__main__":
    main()
