import { test, expect } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

test('quantity units stay visible in mobile quick edits and inline forms', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  state.definitions[0].SizeUnit = state.units.find((unit) => unit.ID === 'kg');
  state.definitions[0].SizeUnitID = 'kg';
  state.inventory[0].Quantity = 800;
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
  await expect(page.getByLabel(copy.ui.quantity, { exact: true })).toHaveAccessibleDescription('kg');
  await expect(page.getByRole('button', { name: copy.ui.saveQuantity, exact: true })).toBeInViewport();
  await page.getByRole('button', { name: copy.ui.cancelEditingQuantity, exact: true }).click();

  await page.getByRole('button', { name: copy.ui.editItem.replace('{{name}}', 'Sample Milk'), exact: true }).click();
  const form = page.getByRole('form', { name: copy.ui.editItem.replace('{{name}}', 'Sample Milk') });
  await expect(form.getByLabel(copy.ui.quantity, { exact: true })).toHaveValue('0.8');
  await expect(form.getByLabel(copy.ui.quantityUnit, { exact: true })).toBeEnabled();
  await expect(form.getByLabel(copy.ui.displayUnit, { exact: true })).toBeEnabled();
  await expect(form.getByLabel(copy.ui.displayUnit).locator('option')).toHaveText([copy.ui.inheritDefinitionUnit.replace('{{unit}}', 'kg'), 'kg', 'g']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const screenshot = info.outputPath('quantity-units.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('Quantity and unit layout', { path: screenshot, contentType: 'image/png' });

  await form.getByLabel(copy.ui.quantity, { exact: true }).fill('0.0000125');
  const save = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/inventory/seed-inventory'));
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  expect((await save).postDataJSON()).toEqual({ quantity: 0.0000125, quantity_unit_id: 'kg' });
  await expect(form).toBeHidden();
});

test('new stock submits an explicit input unit and accepts zero', async ({ page }, info) => {
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
  await expect(page.getByLabel(copy.ui.quantityUnit, { exact: true })).toBeEnabled();
  await page.getByLabel(copy.ui.quantityRequiredLabel).fill('0');
  const create = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/inventory'));
  await page.getByRole('button', { name: copy.ui.addItem, exact: true }).click();
  expect((await create).postDataJSON()).toEqual({ item_definition_id: 'seed-definition', quantity: 0, quantity_unit_id: 'unit' });
});

test('base stock, independent display overrides and definition defaults survive reload', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  const definition = state.definitions[0];
  definition.SizeUnit = state.units.find((unit) => unit.ID === 'kg');
  definition.SizeUnitID = 'kg';
  definition.LowStockThreshold = 1000;
  definition.TargetQuantity = 2000;
  state.inventory[0].Quantity = 3000;
  state.inventory.push({ ...state.inventory[0], ID: 'second-stock', Quantity: 500, DisplaySizeUnitID: null });
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  const editQuantity = (value: string) => page.getByRole('button', { name: copy.ui.editQuantity.replace('{{name}}', 'Sample Milk').replace('{{quantity}}', value), exact: true });
  await editQuantity('3 kg').click();
  await page.getByLabel(copy.ui.quantityUnit, { exact: true }).selectOption('g');
  await expect(page.getByLabel(copy.ui.quantity, { exact: true })).toHaveValue('3000');
  await page.getByLabel(copy.ui.quantity, { exact: true }).fill('800');
  await page.getByLabel(copy.ui.displayUnit, { exact: true }).selectOption('g');
  const stockWrite = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/inventory/seed-inventory'));
  await page.getByRole('button', { name: copy.ui.saveQuantity, exact: true }).click();
  expect((await stockWrite).postDataJSON()).toEqual({ quantity: 800, quantity_unit_id: 'g', display_size_unit_id: 'g' });
  await page.reload();
  await expect(editQuantity('800 g')).toBeVisible();
  const expiry = state.inventory[0].expiry_date;
  await editQuantity('800 g').click();
  await page.getByLabel(copy.ui.displayUnit, { exact: true }).selectOption('kg');
  const displayWrite = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith('/inventory/seed-inventory'));
  await page.getByRole('button', { name: copy.ui.saveQuantity, exact: true }).click();
  expect((await displayWrite).postDataJSON()).toEqual({ display_size_unit_id: 'kg' });
  await expect.poll(() => state.inventory[0].DisplaySizeUnitID).toBe('kg');
  expect(state.inventory[0].Quantity).toBe(800);
  expect(state.inventory[0].expiry_date).toBe(expiry);
  await page.reload();
  await expect(editQuantity(`${language === 'tr' ? '0,8' : '0.8'} kg`)).toBeVisible();

  await page.goto('/item-definitions');
  await page.getByRole('button', { name: copy.ui.editDefinition.replace('{{name}}', 'Sample Milk'), exact: true }).click();
  const unitSelect = page.getByLabel(copy.ui.sizeUnit, { exact: true });
  await expect(unitSelect.locator('option')).toHaveText(['kg', 'g']);
  await unitSelect.selectOption('g');
  await expect(page.getByLabel(copy.ui.lowStockThreshold, { exact: true })).toHaveValue('1000');
  await expect(page.getByLabel(copy.ui.targetQuantity, { exact: true })).toHaveValue('2000');
  await page.getByRole('button', { name: copy.ui.save, exact: true }).click();
  await page.goto('/');
  await expect(editQuantity(`${language === 'tr' ? '0,8' : '0.8'} kg`)).toBeVisible();
  await expect(editQuantity('500 g')).toBeVisible();
  expect(state.definitions[0].LowStockThreshold).toBe(1000);
  expect(state.definitions[0].TargetQuantity).toBe(2000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
