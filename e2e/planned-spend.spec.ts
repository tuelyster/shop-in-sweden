import { expect, test } from '@playwright/test';

// The e2e database is seeded only (no price import), so Price Gaps are unknown here; the numbers
// are covered by the calculator tests and the server tests that import the recorded fixtures.
test('Planned Spend gives a Net Saving, shows missing price data honestly, and is part of the shared URL', async ({ page, browser }) => {
  await page.goto('/?dato=2026-11-14');
  const trips = page.getByTestId('shopping-trip');
  await expect(trips.first().getByTestId('price-gap-value').first()).toHaveText('ingen prisdata endnu');

  await page.getByLabel('Dagligvarer').fill('1000');
  await expect(page).toHaveURL(/kr-dagligvarer=1000/);
  // Gap unknown, not 0 %: nothing is saved, so the trip is a loss equal to its cost.
  await expect(trips.first().getByTestId('net-saving')).toHaveText(/Du taber .*840/);
  await expect(trips.nth(1).getByTestId('net-saving')).toHaveText(/Du taber .*595/);
  await expect(trips.first().getByTestId('unknown-gaps')).toContainText('Dagligvarer');
  await expect(trips.nth(1)).toHaveAttribute('data-cheaper', 'true');

  // A Category expands to its Basket Items.
  await trips.first().getByTestId('price-gap').first().locator('summary').click();
  await expect(trips.first().getByTestId('basket-item').first()).toContainText('Whole milk');

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel('Dagligvarer')).toHaveValue('1000');
  await expect(other.getByTestId('shopping-trip').nth(1).getByTestId('net-saving')).toHaveText(/Du taber .*595/);
  await context.close();
});
