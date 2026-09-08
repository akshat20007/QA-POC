import type { Page, Locator } from 'playwright';
import { selectors } from 'playwright';
import type { LocatorSpec, TranslatedStep } from './types.js';

export const BASE_URL = 'https://www.saucedemo.com';
export const ACTION_TIMEOUT_MS = 8000;

// Sauce Demo's own test-hook attribute (confirmed in qa-poc/context/saucedemo.md) is data-test,
// not Playwright's default data-testid - configure getByTestId() to match it. This is a
// process-wide, one-time setting; safe here since this project only ever targets this one site.
selectors.setTestIdAttribute('data-test');

export function locatorFor(page: Page, spec: LocatorSpec): Locator {
  if (spec.strategy === 'role') {
    const role = spec.role as Parameters<Page['getByRole']>[0];
    return spec.name !== undefined ? page.getByRole(role, { name: spec.name }) : page.getByRole(role);
  }
  if (spec.strategy === 'testid') {
    return page.getByTestId(spec.testId);
  }
  return page.getByText(spec.text);
}

export function describeSelector(spec: LocatorSpec): string {
  if (spec.strategy === 'role') {
    return spec.name !== undefined ? `getByRole('${spec.role}', { name: '${spec.name}' })` : `getByRole('${spec.role}')`;
  }
  if (spec.strategy === 'testid') {
    return `getByTestId('${spec.testId}')`;
  }
  return `getByText('${spec.text}')`;
}

export interface StepResult {
  selectorUsed: string;
}

/** Applies one translated step to a live Playwright page. Throws on failure. When `override`
 * is given, use its resolved locator instead of re-deriving one from step.locator - this is
 * how the disambiguation fallback (disambiguate.ts) retries a step after resolving a strict-mode
 * violation, without re-triggering the same ambiguity. */
export async function applyStep(
  page: Page,
  step: TranslatedStep,
  override?: { locator: Locator; selectorUsed: string },
): Promise<StepResult> {
  if (step.kind === 'navigate') {
    await page.goto(step.url);
    return { selectorUsed: `goto('${step.url}')` };
  }

  const locator = override?.locator ?? locatorFor(page, step.locator);
  const selectorUsed = override?.selectorUsed ?? describeSelector(step.locator);

  switch (step.kind) {
    case 'click':
      await locator.click();
      break;
    case 'fill':
      await locator.fill(step.value);
      break;
    case 'select':
      await locator.selectOption({ label: step.value });
      break;
    case 'checkVisible':
    case 'checkText':
      await locator.waitFor({ state: 'visible' });
      break;
    case 'checkHidden':
      await locator.waitFor({ state: 'hidden' });
      break;
  }

  return { selectorUsed };
}

/** Retries a failing step once (basic retry, no selector-strategy switching / self-healing). */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (exc) {
    if (retries <= 0) throw exc;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return withRetry(fn, retries - 1);
  }
}

/** Hardcoded valid-login sequence, reused wherever a test needs an already-logged-in session. */
export async function performValidLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Username' }).fill('standard_user');
  await page.getByRole('textbox', { name: 'Password' }).fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
}
