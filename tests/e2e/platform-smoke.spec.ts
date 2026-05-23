import { test, expect } from '@playwright/test';

test.describe('platform smoke', () => {
  test('login redirects to home and sidebar shows the smoke module', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Password').fill(process.env.DASHBOARD_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: 'Smoke Test' })).toBeVisible();
  });

  test('module page renders', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').fill(process.env.DASHBOARD_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await page.goto('/smoke');
    await expect(page.getByRole('heading', { name: 'Smoke Test' })).toBeVisible();
  });

  test('module API health returns ok', async ({ page, context }) => {
    // Server actions don't accept plain form POSTs, so log in via the browser
    // form, then reuse the browser context's session cookie for the API call.
    await page.goto('/login');
    await page.getByLabel('Password').fill(process.env.DASHBOARD_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    const res = await context.request.get('/api/smoke/health');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { status: string; module: string };
    expect(body.status).toBe('ok');
    expect(body.module).toBe('smoke');
  });
});
