import type {
  LocatorSpec,
  TestCase,
  TestStep,
  TranslatedStep,
  TranslationError,
  TranslationResult,
} from './types.js';

const ROLE_PREFIXES = [
  'button',
  'textbox',
  'link',
  'checkbox',
  'heading',
  'radio',
  'combobox',
  'listitem',
  'img',
];

class StepTranslationError extends Error {}

/** Strips a "url:" prefix, or accepts a bare http(s) URL. Returns null if the hint isn't a URL. */
function parseUrlHint(hint: string): string | null {
  const prefixed = /^url:\s*(.+)$/i.exec(hint.trim());
  if (prefixed) return prefixed[1].trim();
  if (/^https?:\/\//i.test(hint.trim())) return hint.trim();
  return null;
}

/** Maps a target_hint to a Playwright locator strategy: role prefix > text prefix > raw text fallback. */
export function parseTargetHint(hint: string): LocatorSpec {
  const trimmed = hint.trim();

  const roleMatch = new RegExp(`^(${ROLE_PREFIXES.join('|')}):\\s*(.*)$`, 'i').exec(trimmed);
  if (roleMatch) {
    const role = roleMatch[1].toLowerCase();
    const name = roleMatch[2].trim();
    return name ? { strategy: 'role', role, name } : { strategy: 'role', role };
  }

  // A bare role keyword with no colon and no name at all - e.g. an unlabeled <select>
  // that has no accessible name to filter on. Resolves to "the only element with this
  // role on the page"; multiple matches surface as a Playwright strict-mode violation
  // at execution time, same as any other ambiguous selector guess.
  const bareRoleMatch = new RegExp(`^(${ROLE_PREFIXES.join('|')})$`, 'i').exec(trimmed);
  if (bareRoleMatch) {
    return { strategy: 'role', role: bareRoleMatch[1].toLowerCase() };
  }

  const textMatch = /^text:\s*(.+)$/i.exec(trimmed);
  if (textMatch) {
    return { strategy: 'text', text: textMatch[1].trim() };
  }

  return { strategy: 'text', text: trimmed };
}

type ActionKind = 'navigate' | 'click' | 'fill' | 'select' | 'checkVisible' | 'checkHidden' | 'checkText';

/** True if `word` appears in `text` as a whole word, not as a substring of a longer word
 * (e.g. "select" must not match inside "selected"). */
function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

/** Classifies free-text action strings into a small fixed set of kinds via keyword matching. */
export function classifyAction(action: string): ActionKind | null {
  const a = action.toLowerCase();
  if (hasWord(a, 'navigate')) return 'navigate';
  if (hasWord(a, 'click')) return 'click';
  if (hasWord(a, 'fill') || hasWord(a, 'enter')) return 'fill';
  if (hasWord(a, 'select') || hasWord(a, 'choose')) return 'select';
  if (
    hasWord(a, 'absent') ||
    hasWord(a, 'hidden') ||
    hasWord(a, 'disappears') ||
    hasWord(a, 'disappeared') ||
    hasWord(a, 'empty') ||
    /\bnot\s+(be\s+)?visible\b/.test(a)
  ) {
    return 'checkHidden';
  }
  if (hasWord(a, 'visible')) return 'checkVisible';
  // "assert" is the LLM's generic, catch-all way of phrasing a `then` step (e.g. "assert
  // product is in cart"); treat it as a synonym of the other assertion words below rather
  // than trying to enumerate every specific phrase that can follow it. It's checked after
  // the negation and visibility tiers above so absence/visibility assertions still route
  // there even when phrased as "assert X is absent" / "assert X is visible".
  if (
    hasWord(a, 'assert') ||
    hasWord(a, 'verify') ||
    hasWord(a, 'listed') ||
    hasWord(a, 'shows') ||
    hasWord(a, 'changes') ||
    hasWord(a, 'changed')
  ) {
    return 'checkText';
  }
  return null;
}

export function translateStep(step: TestStep): TranslatedStep {
  const kind = classifyAction(step.action);
  if (!kind) {
    throw new StepTranslationError(`Unrecognized action: "${step.action}"`);
  }

  if (kind === 'navigate') {
    const url = parseUrlHint(step.target_hint);
    if (!url) {
      throw new StepTranslationError(
        `navigate step's target_hint is not a URL: "${step.target_hint}"`,
      );
    }
    return { kind: 'navigate', url };
  }

  const locator = parseTargetHint(step.target_hint);

  if (kind === 'fill') {
    if (!step.value) {
      throw new StepTranslationError(`fill step "${step.action}" has no value to type`);
    }
    return { kind: 'fill', locator, value: step.value };
  }

  if (kind === 'select') {
    if (!step.value) {
      throw new StepTranslationError(`select step "${step.action}" has no value (option) to select`);
    }
    return { kind: 'select', locator, value: step.value };
  }

  if (kind === 'click') {
    return { kind: 'click', locator };
  }

  if (kind === 'checkVisible') {
    return { kind: 'checkVisible', locator };
  }

  if (kind === 'checkHidden') {
    return { kind: 'checkHidden', locator };
  }

  // checkText
  let text: string;
  if (locator.strategy === 'text') {
    text = locator.text;
  } else if (locator.name !== undefined) {
    text = locator.name;
  } else {
    throw new StepTranslationError(
      `checkText step "${step.action}" needs a named target_hint to check for; a nameless role hint has no expected text`,
    );
  }
  return { kind: 'checkText', locator, text };
}

/** Translates every step in a test case, collecting per-step errors instead of throwing. */
export function translateTestCase(testCase: TestCase): TranslationResult {
  const translated: TranslatedStep[] = [];
  const errors: TranslationError[] = [];

  testCase.steps.forEach((step, index) => {
    try {
      translated.push(translateStep(step));
    } catch (exc) {
      errors.push({
        index,
        step,
        message: exc instanceof Error ? exc.message : String(exc),
      });
    }
  });

  return { translated, errors };
}
