import { test, expect, type Page } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

const homeId = '00000000-0000-4000-8000-000000000001';
const key = (n: number) => `${homeId}/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.jpg`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
async function signIn(page: Page, copy: typeof en) {
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
}

test('upload, save, reload, replace, and clear private images', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  const operations: string[] = [];
  let count = 10;
  page.on('request', request => {
    if (/\/api\/v1\/item-definitions/.test(request.url()) && ['POST', 'PUT'].includes(request.method())) {
      const data = request.postDataJSON();
      expect(data.image_url || '').not.toContain('https:');
      operations.push(`save:${data.image_url || ''}`);
    }
  });
  await page.route(/\/api\/v1\/images(?:\?|$)/, async route => {
    const request = route.request();
    expect(request.headers()['x-home-id']).toBe(homeId);
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (request.method() === 'POST') {
      expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=.+/);
      expect(request.postData()).toContain('name="file"');
      expect(request.postData()).toContain('Content-Type: image/jpeg');
      const path = key(count++); operations.push(`upload:${path}`);
      return route.fulfill({ status: 201, json: { path } });
    }
    const path = new URL(request.url()).searchParams.get('path');
    operations.push(`delete:${path}`);
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/images/signed-urls', async route => {
    expect(route.request().headers()['x-home-id']).toBe(homeId);
    const paths = route.request().postDataJSON().paths as string[];
    return route.fulfill({ json: { images: paths.map(path => ({ path, url: `https://storage.googleapis.com/private-fixture/${path}?signature=test`, expires_at: new Date(Date.now() + 3_600_000).toISOString() })) } });
  });
  await page.route('https://storage.googleapis.com/private-fixture/**', route => route.fulfill({ contentType: 'image/png', body: png }));
  await signIn(page, copy);
  await page.goto('/item-definitions/new');
  await page.getByLabel(copy.ui.nameRequired).fill('Private milk');
  await page.getByLabel(copy.ui.sizeUnitRequired).selectOption('unit');
  await page.locator('#image').setInputFiles({ name: 'milk.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: copy.ui.createDefinition, exact: true }).click();
  await expect(page.getByRole('heading', { name: copy.ui.itemDefinitions, exact: true })).toBeVisible();
  expect(operations).toEqual([`upload:${key(10)}`, `save:${key(10)}`]);
  expect(state.definitions.find(def => def.Name === 'Private milk')?.ImageURL).toBe(key(10));
  await page.reload();
  await expect(page.locator('img[src*="000000000010.jpg"]').first()).toHaveAttribute('src', `https://storage.googleapis.com/private-fixture/${key(10)}?signature=test`);
  await expect.poll(() => page.locator('img[src*="000000000010.jpg"]').first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  // Both desktop and mobile edit in the row.
  const row = page.getByRole('row').filter({ hasText: 'Private milk' });
  const editingRow = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: copy.ui.name, exact: true }) });
  await row.getByRole('button', { name: copy.ui.editDefinition.replace('{{name}}', 'Private milk') }).click();
  await editingRow.locator('input[type=file]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
  await editingRow.getByRole('button', { name: copy.ui.save, exact: true }).click();
  await expect.poll(() => operations.slice(-3)).toEqual([`upload:${key(11)}`, `save:${key(11)}`, `delete:${key(10)}`]);
  await row.getByRole('button', { name: copy.ui.editDefinition.replace('{{name}}', 'Private milk') }).click();
  await editingRow.getByRole('button', { name: copy.ui.clearEditImage }).click();
  await editingRow.getByRole('button', { name: copy.ui.save, exact: true }).click();
  await expect.poll(() => operations.slice(-2)).toEqual(['save:', `delete:${key(11)}`]);
  expect(state.definitions.find(def => def.Name === 'Private milk')?.ImageURL).toBe('');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('signed_url_cache_')))).toEqual([]);
});

test('clearing an uncategorized definition image persists before deleting the object', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  state.definitions[0].CategoryID = undefined;
  const operations: string[] = [];
  page.on('request', request => {
    if (request.method() === 'PUT' && request.url().includes('/item-definitions/')) {
      operations.push('save');
    }
  });
  await page.route(/\/api\/v1\/images\?/, async route => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers()['x-home-id']).toBe(homeId);
    expect(new URL(route.request().url()).searchParams.get('path')).toBe(key(2));
    expect(state.definitions[0].ImageURL).toBe('');
    operations.push('delete');
    await route.fulfill({ status: 204 });
  });
  await signIn(page, copy);
  await page.goto('/item-definitions');
  const row = page.getByRole('row').filter({ hasText: 'Sample Milk' });
  await row.getByRole('button', { name: copy.ui.editDefinition.replace('{{name}}', 'Sample Milk') }).click();
  const editingRow = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: copy.ui.name, exact: true }) });
  await editingRow.getByRole('button', { name: copy.ui.clearEditImage }).click();
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/item-definitions/'));
  await editingRow.getByRole('button', { name: copy.ui.save, exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ image_url: '' });
  expect(response.request().postDataJSON()).not.toHaveProperty('category_id');
  await expect.poll(() => operations).toEqual(['save', 'delete']);
  await expect(editingRow).toHaveCount(0);
  await page.reload();
  await expect(row).toBeVisible();
  await expect(row.locator('img')).toHaveCount(0);
  expect(state.definitions[0].ImageURL).toBe('');
  expect(state.definitions[0].CategoryID).toBeUndefined();
});

test('viewer reads images and receives a translated denial when uploading', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  const state = await mockApi(page, language);
  await page.route('**/api/v1/homes', route => route.fulfill({ json: [{ HomeID: homeId, Role: 'viewer', IsDefault: true, Home: { ID: homeId, Name: 'UI Test Home' } }] }));
  let uploads = 0;
  await page.route(/\/api\/v1\/images(?:\?|$)/, route => { uploads++; return route.fulfill({ status: 403, json: { error: 'Write denied' } }); });
  await signIn(page, copy);
  await page.goto('/item-definitions');
  await expect(page.locator('img[src*="ui-test-image.svg"]').first()).toHaveAttribute('src', 'http://localhost:3000/ui-test-image.svg');
  const row = page.getByRole('row').filter({ hasText: 'Sample Milk' });
  const editingRow = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: copy.ui.name, exact: true }) });
  await row.getByRole('button', { name: copy.ui.editDefinition.replace('{{name}}', 'Sample Milk') }).click();
  await editingRow.locator('input[type=file]').setInputFiles({ name: 'denied.png', mimeType: 'image/png', buffer: png });
  await editingRow.getByRole('button', { name: copy.ui.save, exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: copy.ui.imageAccessDenied })).toBeVisible();
  expect(uploads).toBe(1);
  expect(state.definitions[0].ImageURL).toBe(key(2));
});
