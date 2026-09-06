import { expect } from '@playwright/test';
import type { Page } from 'playwright';

export default async function run({ page }: { page: Page }) {
  await page.goto('https://www.saucedemo.com/');
  await page.getByRole('textbox', { name: 'Username' }).fill('standard_user');
  await page.getByRole('textbox', { name: 'Password' }).fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Products')).toBeVisible();
  await expect(page).toHaveURL(/inventory/);
}
