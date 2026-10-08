import { expect, test } from '@playwright/test';

test('shows two Shopping Trips with exactly one highlighted as cheaper', async ({ page }) => {
  await page.goto('/?dato=2026-11-14');
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

test('shows how current the prices are', async ({ page }) => {
  await page.goto('/?dato=2026-11-14');
  // The e2e database has no imported prices, so it says so instead of counting days.
  await expect(page.getByTestId('freshness-line')).toHaveText('Priserne er ikke hentet endnu.');
  await expect(page.getByTestId('stale-warning')).toHaveCount(0);
});

test('invalid query values fall back to defaults',async ({ page }) => {
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

test('ferry fee follows the season of the Trip Date', async ({ page }) => {
  await page.goto('/?dato=2027-05-31');
  const ferry = page.getByTestId('shopping-trip').nth(1);
  await expect(ferry).toContainText('595');
  await page.getByLabel('Dato for turen').fill('2027-06-01');
  await expect(ferry).toContainText('620');
});

test('Discount Agreements change the fees and are part of the shared URL', async ({ page, browser }) => {
  await page.goto('/?dato=2026-11-14');
  await page.getByLabel('ØresundGO (Øresundsbroen)').check();
  await page.getByLabel('Turkort til færgen').selectOption('20-34');
  await expect(page).toHaveURL(/oresundgo=1/);
  await expect(page).toHaveURL(/turkort=20-34/);
  const trips = page.getByTestId('shopping-trip');
  await expect(trips.first()).toContainText('364');
  await expect(trips.nth(1)).toContainText('378');

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel('ØresundGO (Øresundsbroen)')).toBeChecked();
  await expect(other.getByLabel('Turkort til færgen')).toHaveValue('20-34');
  await expect(other.getByTestId('shopping-trip').first()).toContainText('364');
  await context.close();

  await page.getByLabel('Turkort til færgen').selectOption('ingen');
  await page.getByLabel('AutoBizz (færgen)').check();
  await expect(trips.nth(1)).toContainText('450');
});

test('distances give Driving Cost, flip the cheaper trip, and are part of the shared URL', async ({ page, browser }) => {
  await page.goto('/?dato=2026-11-14');
  const trips = page.getByTestId('shopping-trip');
  await expect(page.getByTestId('distance-prompt')).toBeVisible();
  await expect(trips.nth(1).getByTestId('driving-cost')).toContainText('0');
  await expect(trips.nth(1)).toHaveAttribute('data-cheaper', 'true');

  // Petrol default 6 L/100 km at 19.5 kr: 2 x 300 km = 702 kr to Hyllie, 2 x 10 km = 23 kr to Väla.
  await page.getByLabel('Kørsel til Hyllie/Emporia (km, én vej)').fill('300');
  await page.getByLabel('Kørsel til Väla Centrum (km, én vej)').fill('10');
  await expect(page).toHaveURL(/km-bro=300/);
  await expect(page).toHaveURL(/km-faerge=10/);
  await expect(page.getByTestId('distance-prompt')).toHaveCount(0);
  await expect(trips.first().getByTestId('trip-cost')).toContainText('1.542');
  await expect(trips.nth(1).getByTestId('trip-cost')).toContainText('618');

  // Electric: unedited consumption and price follow the new energy type.
  await page.getByLabel('Bilen kører på').selectOption('electric');
  await expect(page).toHaveURL(/energi=el/);
  await expect(trips.nth(1).getByTestId('driving-cost')).toContainText('9');
  await page.getByText('Avanceret').click();
  await page.getByLabel(/Forbrug/).fill('20');
  await expect(page).toHaveURL(/forbrug=20/);

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel('Bilen kører på')).toHaveValue('electric');
  await expect(other.getByLabel('Kørsel til Hyllie/Emporia (km, én vej)')).toHaveValue('300');
  await expect(other.getByTestId('shopping-trip').nth(1).getByTestId('driving-cost')).toContainText('10');
  await context.close();
});
