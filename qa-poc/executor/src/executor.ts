import type { Page, Locator } from 'playwright';
import type { LocatorSpec, TranslatedStep } from './types.js';

export function locatorFor(page: Page, spec: LocatorSpec): Locator {
  if (spec.strategy === 'role') {
    return page.getByRole(spec.role as Parameters<Page['getByRole']>[0], { name: spec.name });
  }
  return page.getByText(spec.text);
}

function describeSelector(spec: LocatorSpec): string {
  return spec.strategy === 'role'
    ? `getByRole('${spec.role}', { name: '${spec.name}' })`
    : `getByText('${spec.text}')`;
}

export interface StepResult {
  selectorUsed: string;
}

/** Applies one translated step to a live Playwright page. Throws on failure. */
export async function applyStep(page: Page, step: TranslatedStep): Promise<StepResult> {
  if (step.kind === 'navigate') {
    await page.goto(step.url);
    return { selectorUsed: `goto('${step.url}')` };
  }

  const locator = locatorFor(page, step.locator);
  const selectorUsed = describeSelector(step.locator);

  switch (step.kind) {
    case 'click':
      await locator.click();
      break;
    case 'fill':
      await locator.fill(step.value);
      break;
    case 'checkVisible':
    case 'checkText':
      await locator.waitFor({ state: 'visible' });
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
