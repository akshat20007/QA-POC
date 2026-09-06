import { expect } from '@playwright/test';
import type { APIRequestContext } from 'playwright';

export default async function run({ request }: { request: APIRequestContext }) {
  const headers: Record<string, string> = {};
  const apiKey = process.env.REQRES_API_KEY;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await request.get('https://reqres.in/api/users?page=1', { headers });
  expect(response.ok(), `expected 2xx, got ${response.status()}`).toBeTruthy();
}
