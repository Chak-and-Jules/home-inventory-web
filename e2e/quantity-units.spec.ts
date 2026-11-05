import { test, expect } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

test('quantity units stay visible in mobile quick edits and inline forms', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  state.definitions[0].SizeUnit!.Name = 'kg';
  state.inventory[0].Quantity = 0.8;
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();

  const quickEdit = page.getByRole('button', {
    name: copy.ui.editQuantity.replace('{{name}}', 'Sample Milk').replace('{{quantity}}', `${language === 'tr' ? '0,8' : '0.8'} kg`),
    exact: true,
  });
  await expect(quickEdit).toContainText(language === 'tr' ? '0,8' : '0.8');
  await expect(quickEdit).toContainText('kg');
  await quickEdit.click();
  await expect(page.getByRole('spinbutton', { name: copy.ui.quantity, exact: true })).toHaveAccessibleDescription('kg');
  await expect(page.getByRole('button', { name: copy.ui.saveQuantity, exact: true })).toBeInViewport();
  await page.getByRole('button', { name: copy.ui.cancelEditingQuantity, exact: true }).click();

  await page.getByRole('button', { name: copy.ui.editItem.replace('{{name}}', 'Sample Milk'), exact: true }).click();
  const form = page.getByRole('form', { name: copy.ui.editItem.replace('{{name}}', 'Sample Milk') });
  await expect(form.getByLabel(copy.ui.quantity, { exact: true })).toHaveValue('0.8');
  await expect(form.getByLabel(copy.ui.quantityUnit, { exact: true })).toBeDisabled();
  await expect(form.getByLabel(copy.ui.displayUnit, { exact: true })).toBeDisabled();
  await expect(form.getByLabel(copy.ui.displayUnit).locator('option')).toHaveText(copy.ui.inheritDefinitionUnit.replace('{{unit}}', 'kg'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const screenshot = info.outputPath('quantity-units.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('Quantity and unit layout', { path: screenshot, contentType: 'image/png' });

  await form.getByLabel(copy.ui.quantity, { exact: true }).fill('0.0000125');
  const save = page.waitForRequest((request) => request.method() === 'PUT' && request.url().endsWith('/inventory/seed-inventory'));
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  expect((await save).postDataJSON()).toEqual({ quantity: 0.0000125, expiry_date: '2030-01-05T00:00:00.000Z' });
  await expect(form).toBeHidden();
});

test('new stock keeps the current quantity payload while presenting separate units', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  await mockApi(page, language);
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.goto('/inventory/new');
  await expect(page.getByLabel(copy.ui.quantityRequiredLabel)).toBeDisabled();
  await page.getByLabel(copy.ui.itemDefinitionRequired).selectOption('seed-definition');
  await expect(page.getByLabel(copy.ui.quantityRequiredLabel)).toBeEnabled();
  await expect(page.getByLabel(copy.ui.quantityUnit, { exact: true })).toBeDisabled();
  await page.getByLabel(copy.ui.quantityRequiredLabel).fill('0');
  const create = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/inventory'));
  await page.getByRole('button', { name: copy.ui.addItem, exact: true }).click();
  expect((await create).postDataJSON()).toEqual({ item_definition_id: 'seed-definition', quantity: 0 });
});
