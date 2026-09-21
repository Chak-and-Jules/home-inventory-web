import { test, expect, type Page } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

const interpolate = (text: string, name: string) => text.replace('{{name}}', name);
async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('theme, image modal, quantity quick edit and inline edit survive reload', async ({
  page,
}, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const mobile = info.project.name.endsWith('mobile');
  const state = await mockApi(page, language);
  await signIn(page, copy);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  await noOverflow(page);
  await expect(
    page.getByRole('columnheader', { name: copy.ui.quantity, exact: true }),
  ).toBeVisible();
  if (mobile) {
    await expect(
      page.getByRole('columnheader', { name: copy.ui.category, exact: true }),
    ).toBeHidden();
    await page
      .getByRole('cell')
      .filter({ hasText: 'Sample Milk', hasNot: page.getByRole('button') })
      .click();
  }
  await page
    .getByRole('button', { name: interpolate(copy.ui.viewImage, 'Sample Milk'), exact: true })
    .click();
  const modal = page.getByRole('dialog', { name: 'Sample Milk' });
  await expect(modal.getByRole('img')).toBeVisible();
  await expect(modal.getByRole('img')).toHaveCSS('object-fit', 'contain');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  if (mobile) await page.getByRole('button', { name: copy.ui.closeDetails }).click();
  await page
    .getByRole('button', {
      name: interpolate(copy.ui.editQuantity, 'Sample Milk').replace('{{quantity}}', '2'),
    })
    .click();
  await page.getByRole('spinbutton').fill('5');
  await expect(
    page.getByRole('button', { name: copy.ui.saveQuantity, exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: copy.ui.saveQuantity, exact: true }).click();
  await expect.poll(() => state.inventory[0].Quantity).toBe(5);
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editQuantity, 'Sample Milk').replace('{{quantity}}', '5'),
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: interpolate(copy.ui.editItem, 'Sample Milk'), exact: true })
    .click();
  const form = page.getByRole('form', { name: interpolate(copy.ui.editItem, 'Sample Milk') });
  await expect(form).toBeVisible();
  await expect(page).toHaveURL('/');
  await form.getByLabel(copy.ui.quantity, { exact: true }).fill('7');
  await form.getByLabel(copy.ui.expirationDate).fill('2030-02-10');
  state.failUpdate = true;
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText(copy.ui.updateFailed);
  await expect(form.getByLabel(copy.ui.quantity, { exact: true })).toHaveValue('7');
  state.failUpdate = false;
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editQuantity, 'Sample Milk').replace('{{quantity}}', '7'),
    }),
  ).toBeVisible();
  expect(state.inventory[0].ExpirationDate).toBe('2030-02-10T00:00:00.000Z');
  state.definitions.push({ ...state.definitions[0], ID: 'second-definition', Name: 'Sample Rice' });
  await page.getByRole('tab', { name: new RegExp(copy.inventory.tabs.almostFinished) }).click();
  await expect(page.getByText('low_stock', { exact: true })).toHaveCount(0);
  await expect(page.getByText('threshold_met', { exact: true })).toHaveCount(0);
  if (!mobile)
    await expect(page.getByText(copy.inventory.reasons.low_stock, { exact: true })).toBeVisible();
  await noOverflow(page);
  state.theme = 'Light';
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('maintenance edits stay inline and populate the selected task', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  state.tasks.push({
    ID: 'task-one',
    HomeID: 'ui-test-home',
    Description: 'Replace filter',
    Frequency: 'monthly',
    ScheduledDate: '2030-03-01T00:00:00Z',
    IsCompleted: false,
    CreatedAt: '',
    UpdatedAt: '',
  });
  await signIn(page, copy);
  await page.goto('/maintenance');
  await page.getByRole('button', { name: copy.maintenance.editTask, exact: true }).click();
  const form = page.getByRole('form', { name: copy.maintenance.editTask });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(form.getByLabel(copy.maintenance.descriptionLabel)).toHaveValue('Replace filter');
  await expect(form.getByLabel(copy.maintenance.frequency, { exact: true })).toHaveValue('monthly');
  await form.getByLabel(copy.maintenance.descriptionLabel).fill('Replace filter updated');
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole('cell', { name: 'Replace filter updated', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test('empty and failed inventory states are distinguished', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  state.inventory = [];
  await signIn(page, copy);
  await expect(page.getByText(copy.ui.noItemsFoundInYourInventory, { exact: true })).toBeVisible();
  await page.route('**/api/v1/inventory?*', (route) =>
    route.fulfill({ status: 500, json: { error: 'Test failure' } }),
  );
  await page.reload();
  await expect(page.getByText(copy.ui.loadFailed, { exact: true })).toBeVisible();
  await expect(page.getByText(copy.ui.noItemsFoundInYourInventory, { exact: true })).toHaveCount(0);
});

test('category, definition and inventory create/edit/delete journey', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  const name = `UI ${info.project.name}-${info.workerIndex}`;
  await signIn(page, copy);
  await expect(page.getByLabel(copy.ui.filterByCategory).locator('option')).toHaveText([
    copy.ui.allCategories,
    '- Food',
    '  Apples',
    '  Zucchini',
    '- Tools',
  ]);
  await page.goto('/categories/new');
  await page.getByLabel(copy.categories.name, { exact: true }).fill(name);
  await page.getByRole('button', { name: copy.categories.create, exact: true }).click();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  await page.goto('/item-definitions/new');
  const category = page.getByLabel(copy.ui.categoryOptional);
  await expect(category.locator('option')).toHaveText([
    copy.ui.none,
    '- Food',
    '  Apples',
    '  Zucchini',
    '- Tools',
    `- ${name}`,
  ]);
  await category.selectOption({ label: `- ${name}` });
  await page.getByLabel(copy.ui.nameRequired, { exact: true }).fill(name);
  await page.getByLabel(copy.ui.sizeUnitRequired).selectOption('unit');
  await page.getByRole('button', { name: copy.ui.createDefinition, exact: true }).click();
  await expect(
    page.getByRole('button', { name: interpolate(copy.ui.editDefinition, name), exact: true }),
  ).toBeVisible();
  await page.goto('/inventory/new');
  await page.getByLabel(copy.ui.itemDefinitionRequired).selectOption({ label: name });
  await page.getByLabel(copy.ui.quantityRequiredLabel).fill('3');
  await page.getByRole('button', { name: copy.ui.addItem, exact: true }).click();
  await expect(
    page.getByRole('button', { name: interpolate(copy.ui.editItem, name), exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: interpolate(copy.ui.editItem, name), exact: true })
    .click();
  const form = page.getByRole('form', { name: interpolate(copy.ui.editItem, name) });
  await form.getByLabel(copy.ui.quantity, { exact: true }).fill('4');
  await form.getByRole('button', { name: copy.categories.save, exact: true }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editQuantity, name).replace('{{quantity}}', '4'),
    }),
  ).toBeVisible();
  await page.goto('/item-definitions');
  await page
    .getByRole('button', { name: interpolate(copy.ui.editDefinition, name), exact: true })
    .click();
  await page.getByRole('textbox', { name: copy.ui.name, exact: true }).fill(`${name} edited`);
  await expect(page.getByLabel(copy.ui.sizeUnit, { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: copy.ui.save, exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editDefinition, `${name} edited`),
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editDefinition, `${name} edited`),
      exact: true,
    }),
  ).toBeVisible();
  await page.goto('/categories');
  await page.getByRole('button', { name: `${copy.categories.edit} ${name}`, exact: true }).click();
  await page
    .getByRole('textbox', { name: copy.categories.tableName, exact: true })
    .fill(`${name} edited`);
  await page.getByRole('button', { name: copy.categories.save, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `${copy.categories.edit} ${name} edited`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: `${copy.categories.edit} ${name} edited`, exact: true }),
  ).toBeVisible();
  await page.goto('/');
  await page
    .getByRole('button', {
      name: interpolate(copy.ui.deleteItemNamed, `${name} edited`),
      exact: true,
    })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: copy.categories.cancel, exact: true }).click();
  expect(state.inventory).toHaveLength(2);
  await page.getByRole('button', { name: interpolate(copy.ui.deleteItemNamed, `${name} edited`), exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: copy.ui.delete, exact: true }).click();
  await expect.poll(() => state.inventory.length).toBe(1);
  await expect(page.getByRole('cell', { name: `${name} edited`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editItem, `${name} edited`),
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto('/item-definitions');
  await page
    .getByRole('button', {
      name: interpolate(copy.ui.deleteDefinition, `${name} edited`),
      exact: true,
    })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: copy.ui.delete, exact: true }).click();
  await expect.poll(() => state.definitions.length).toBe(1);
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editDefinition, `${name} edited`),
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: interpolate(copy.ui.editDefinition, `${name} edited`),
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto('/categories');
  await page
    .getByRole('button', { name: `${copy.categories.delete} ${name} edited`, exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: copy.ui.delete, exact: true }).click();
  await expect.poll(() => state.categories.length).toBe(4);
  await expect(page.getByRole('cell', { name: `${name} edited`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('cell', { name: `${name} edited`, exact: true })).toHaveCount(0);
  expect(state.inventory).toHaveLength(1);
  expect(state.definitions).toHaveLength(1);
  expect(state.categories).toHaveLength(4);
});
