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
  const parsed = JSON.parse(
    readFileSync(path.join(OUTPUT_DIR, 'login_invalid.json'), 'utf-8'),
  ) as TestCase | TestCase[];
  const allCases = Array.isArray(parsed) ? parsed : [parsed];
  // Only "negative" cases assert an error stays discriminating; a happy-path case in the same
  // file (the mixed-category prompt can put one here) asserts the opposite thing on purpose,
  // so checking "does this NOT show up after a valid login" against it would be backwards.
  const testCases = allCases.filter((tc) => tc.category === 'negative');

  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });

  let anyFalsePass = false;
  let checked = 0;

  for (const testCase of testCases) {
    const { translated, errors } = translateTestCase(testCase);
    if (errors.length > 0) {
      console.log(`\n=== Skipping "${testCase.name}" — failed to translate: ${JSON.stringify(errors)} ===`);
      continue;
    }

    const lastStep = translated[translated.length - 1];
    if (!lastStep || (lastStep.kind !== 'checkVisible' && lastStep.kind !== 'checkText')) {
      console.log(`\n=== Skipping "${testCase.name}" — last step is not an assertion ===`);
      continue;
    }

    checked += 1;
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

    await context.close();

    console.log(`\n=== Negative control: "${testCase.name}" ===`);
    console.log(`Selector under test: ${selectorDesc}`);
    if (foundAfterValidLogin) {
      anyFalsePass = true;
      console.log(
        'VERDICT: FALSE PASS DETECTED — this selector also matches after a valid login.\n' +
          'This test case\'s PASS cannot be trusted; the check is not discriminating.',
      );
    } else {
      console.log(
        'VERDICT: Negative control PASSED — the selector does NOT match after a valid login.\n' +
          "This test case's PASS is a genuine pass, not a false positive.",
      );
    }
  }

  await browser.close();

  if (checked === 0) {
    console.error('\nCannot run negative control: no assertable test cases found in login_invalid.json.');
    process.exit(1);
  }

  console.log(`\n=== Summary: checked ${checked} test case(s), ${anyFalsePass ? 'FALSE PASS DETECTED' : 'all genuine'} ===`);
  process.exit(anyFalsePass ? 1 : 0);
}

main();
