// Ad-hoc script: feeds the 3 real Phase 1 generated test cases (from output/results.log)
// through the translator to confirm zero translation errors against live LLM output.
import { translateTestCase } from './translator.js';
import type { TestCase } from './types.js';

const liveTestCases: TestCase[] = [
  {
    name: 'Add product to cart and verify cart contents',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'given', action: 'navigate to products page', target_hint: 'url: /inventory.html' },
      { type: 'when', action: 'click add to cart button', target_hint: 'button: Add to cart' },
      { type: 'then', action: 'assert cart badge shows 1', target_hint: 'text: 1' },
      { type: 'when', action: 'click cart icon', target_hint: 'link: 1' },
      { type: 'then', action: 'assert product is listed in cart', target_hint: 'text: Sauce Labs Backpack' },
    ],
  },
  {
    name: 'Invalid login attempt shows error and blocks access',
    priority: 'high',
    category: 'negative',
    steps: [
      { type: 'given', action: 'navigate to login page', target_hint: 'https://www.saucedemo.com/' },
      { type: 'when', action: 'fill username', target_hint: 'textbox: Username', value: 'wrong_user' },
      { type: 'when', action: 'fill password', target_hint: 'textbox: Password', value: 'wrong_pass' },
      { type: 'when', action: 'click login button', target_hint: 'button: Login' },
      {
        type: 'then',
        action: 'assert error message visible',
        target_hint: 'Epic sadface: Username and password do not match any user in this service',
      },
    ],
  },
  {
    name: 'Successful login with valid credentials',
    priority: 'high',
    category: 'happy-path',
    steps: [
      { type: 'given', action: 'navigate to login page', target_hint: 'https://www.saucedemo.com/' },
      { type: 'when', action: 'fill username', target_hint: 'textbox: Username', value: 'standard_user' },
      { type: 'when', action: 'fill password', target_hint: 'textbox: Password', value: 'secret_sauce' },
      { type: 'when', action: 'click login button', target_hint: 'button: Login' },
      { type: 'then', action: 'assert products page title visible', target_hint: 'Products' },
    ],
  },
];

let totalErrors = 0;
for (const testCase of liveTestCases) {
  const result = translateTestCase(testCase);
  console.log(`\n=== ${testCase.name} ===`);
  console.log(JSON.stringify(result, null, 2));
  totalErrors += result.errors.length;
}

console.log(`\n=== Summary: ${totalErrors} translation error(s) across ${liveTestCases.length} live test cases ===`);
process.exit(totalErrors === 0 ? 0 : 1);
