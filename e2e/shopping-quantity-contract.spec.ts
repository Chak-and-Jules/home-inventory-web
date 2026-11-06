import { test, expect, type Page } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.goto('/shopping-list');
}

test('independent shopping counts reject excessive precision before JSON serialization', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  await mockApi(page, language);
  const writes: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/shopping-list')) writes.push(request.postDataJSON());
  });
  await signIn(page, copy);
  await page.getByLabel(copy.shoppingList.itemName).fill('Paper');
  const input = page.getByLabel(copy.shoppingList.quantity, { exact: true });
  await input.fill('0.10000000000000000001');
  await expect(input).toHaveValue('0.10000000000000000001');
  await page.getByRole('button', { name: copy.shoppingList.add, exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText(copy.ui.invalidQuantity);
  expect(writes).toEqual([]);
  await input.fill('0.0000001');
  await page.getByRole('button', { name: copy.shoppingList.add, exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText(copy.ui.invalidQuantity);
  expect(writes).toEqual([]);
  await input.fill(language === 'tr' ? '0,000001' : '0.000001');
  const save = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/shopping-list'));
  await page.getByRole('button', { name: copy.shoppingList.add, exact: true }).click();
  expect((await save).postDataJSON()).toEqual({ name: 'Paper', quantity: 0.000001 });
});

test('predictive restocking uses the threshold shortage after the target is met', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  const definition = state.definitions[0];
  definition.SizeUnit = state.units.find((unit) => unit.ID === 'kg');
  definition.SizeUnitID = 'kg';
  definition.TargetQuantity = 1000;
  definition.LowStockThreshold = 5000;
  state.restockInsights.push({ item_definition: definition, current_stock: 1000, average_daily_consumption: 100,
    predicted_depletion_date: '2030-01-05T00:00:00Z', days_left: 3, reason: '',
  });
  await signIn(page, copy);
  const save = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/shopping-list'));
  await page.getByRole('button', { name: copy.ui.accept, exact: true }).click();
  expect((await save).postDataJSON()).toEqual({ name: definition.Name, item_definition_id: definition.ID, quantity: 4000, quantity_unit_id: 'g' });
});
