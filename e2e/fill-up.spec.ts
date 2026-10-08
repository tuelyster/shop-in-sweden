import { expect, test } from '@playwright/test';

test('the litres input is for petrol Vehicles only and is part of the shared URL', async ({ page, browser }) => {
  await page.goto('/?dato=2026-11-14');
  const litres = page.getByLabel('Liter benzin du tanker i Sverige');
  await expect(litres).toBeVisible();

  await litres.fill('40');
  await expect(page).toHaveURL(/liter=40/);

  await page.getByLabel('Bilen kører på').selectOption('electric');
  await expect(litres).toHaveCount(0);

  await page.getByLabel('Bilen kører på').selectOption('petrol');
  await expect(page.getByLabel('Liter benzin du tanker i Sverige')).toHaveValue('40');

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByLabel('Liter benzin du tanker i Sverige')).toHaveValue('40');
  await context.close();
});
