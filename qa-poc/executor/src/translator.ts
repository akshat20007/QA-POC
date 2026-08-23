import type {
  LocatorSpec,
  TestCase,
  TestStep,
  TranslatedStep,
  TranslationError,
  TranslationResult,
} from './types.js';

const ROLE_PREFIXES = ['button', 'textbox', 'link', 'checkbox'];

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

  const roleMatch = new RegExp(`^(${ROLE_PREFIXES.join('|')}):\\s*(.+)$`, 'i').exec(trimmed);
  if (roleMatch) {
    return { strategy: 'role', role: roleMatch[1].toLowerCase(), name: roleMatch[2].trim() };
  }

  const textMatch = /^text:\s*(.+)$/i.exec(trimmed);
  if (textMatch) {
    return { strategy: 'text', text: textMatch[1].trim() };
  }

  return { strategy: 'text', text: trimmed };
}

type ActionKind = 'navigate' | 'click' | 'fill' | 'checkVisible' | 'checkText';

/** Classifies free-text action strings into a small fixed set of kinds via keyword matching. */
export function classifyAction(action: string): ActionKind | null {
  const a = action.toLowerCase();
  if (a.includes('navigate')) return 'navigate';
  if (a.includes('click')) return 'click';
  if (a.includes('fill') || a.includes('enter')) return 'fill';
  if (a.includes('visible')) return 'checkVisible';
  if (a.includes('verify') || a.includes('listed') || a.includes('shows')) return 'checkText';
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

  if (kind === 'click') {
    return { kind: 'click', locator };
  }

  if (kind === 'checkVisible') {
    return { kind: 'checkVisible', locator };
  }

  // checkText
  const text = locator.strategy === 'text' ? locator.text : locator.name;
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
