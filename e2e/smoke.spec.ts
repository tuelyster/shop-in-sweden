import { expect, test } from '@playwright/test';

test('shows two Shopping Trips with exactly one highlighted as cheaper', async ({ page }) => {
  await page.goto('/');
  const trips = page.getByTestId('shopping-trip');
  await expect(trips).toHaveCount(2);
  await expect(page.locator('[data-testid="shopping-trip"][data-cheaper="true"]')).toHaveCount(1);
  await expect(page.getByText('Billigste tur')).toHaveCount(1);
  await expect(trips.first()).toContainText('840');
  await expect(trips.nth(1)).toContainText('595');
});

test('inputs are mirrored into the URL and restored from a shared URL', async ({ page, browser, baseURL }) => {
  await page.goto('/');
  const date = page.getByLabel('Dato for turen');
  await expect(date).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);

  // Changing an input updates the query string without a reload.
  await page.evaluate(() => ((window as any).__marker = 'same-page'));
  await date.fill('2026-12-24');
  await expect(page).toHaveURL(/dato=2026-12-24/);
  expect(await page.evaluate(() => (window as any).__marker)).toBe('same-page');

  // A fresh browser context (no storage) opening the shared URL sees the same input and result.
  const sharedUrl = page.url();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(sharedUrl);
  await expect(other.getByLabel('Dato for turen')).toHaveValue('2026-12-24');
  await expect(other.getByTestId('shopping-trip')).toHaveCount(2);
  await expect(other.getByTestId('shopping-trip').first()).toContainText('840');
  await context.close();

  // No query string: last inputs come back from browser storage and into the URL.
  await page.goto(baseURL!);
  await expect(page.getByLabel('Dato for turen')).toHaveValue('2026-12-24');
  await expect(page).toHaveURL(/dato=2026-12-24/);
});

test('invalid query values fall back to defaults', async ({ page }) => {
  await page.goto('/?dato=i-morgen&ukendt=1');
  await expect(page.getByLabel('Dato for turen')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByTestId('shopping-trip')).toHaveCount(2);
});

test('works when browser storage throws', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/?dato=2026-11-07`);
  await expect(page.getByLabel('Dato for turen')).toHaveValue('2026-11-07');
  await page.getByLabel('Dato for turen').fill('2026-11-14');
  await expect(page).toHaveURL(/dato=2026-11-14/);
  await expect(page.getByTestId('shopping-trip')).toHaveCount(2);
  await context.close();
});
