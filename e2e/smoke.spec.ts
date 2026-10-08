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
