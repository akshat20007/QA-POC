// Phase 4 — Negative case validation.
// Proves login_invalid's error-message assertion is discriminating: it must NOT
// also match after a genuinely successful login. If it does, that's a false
// pass — the check would report PASS even if the app had a real auth bug.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { translateTestCase } from './translator.js';
import { locatorFor, describeSelector, performValidLogin, BASE_URL, ACTION_TIMEOUT_MS } from './executor.js';
import type { TestCase } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

async function main() {
  const testCase = JSON.parse(
    readFileSync(path.join(OUTPUT_DIR, 'login_invalid.json'), 'utf-8'),
  ) as TestCase;

  const { translated, errors } = translateTestCase(testCase);
  if (errors.length > 0) {
    console.error('Cannot run negative control: login_invalid.json failed to translate:', errors);
    process.exit(1);
  }

  const lastStep = translated[translated.length - 1];
  if (!lastStep) {
    console.error('Cannot run negative control: login_invalid.json translated to zero steps.');
    process.exit(1);
  }
  if (lastStep.kind !== 'checkVisible' && lastStep.kind !== 'checkText') {
    console.error(`Expected login_invalid's last step to be an assertion, got "${lastStep.kind}"`);
    process.exit(1);
  }

  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ baseURL: BASE_URL });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  const page = await context.newPage();

  await performValidLogin(page);

  const locator = locatorFor(page, lastStep.locator);
  const selectorDesc = describeSelector(lastStep.locator);

  let foundAfterValidLogin: boolean;
  try {
    await locator.waitFor({ state: 'visible', timeout: 3000 });
    foundAfterValidLogin = true;
  } catch {
    foundAfterValidLogin = false;
  }

  await browser.close();

  console.log(`\n=== Negative control: login_invalid's error-message check ===`);
  console.log(`Selector under test: ${selectorDesc}`);
  if (foundAfterValidLogin) {
    console.log(
      'VERDICT: FALSE PASS DETECTED — this selector also matches after a valid login.\n' +
        'login_invalid\'s PASS in Phase 3 cannot be trusted; the check is not discriminating.',
    );
    process.exit(1);
  } else {
    console.log(
      'VERDICT: Negative control PASSED — the selector does NOT match after a valid login.\n' +
        "login_invalid's PASS in Phase 3 is a genuine pass, not a false positive.",
    );
  }
}

main();
