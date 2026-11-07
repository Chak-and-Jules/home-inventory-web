import { test, expect } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import tr from '../src/lib/i18n/locales/tr/common.json';
import { mockApi } from './mock-api';

test('restores Firebase sign-in and retains the internal UUID for deletion failure and retry', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  await mockApi(page, language);
  let failDeletion = true;
  let deletionCalls = 0;
  await page.route('**/api/v1/profiles/delete-account', async route => {
    deletionCalls++;
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().postDataJSON()).toEqual({
      user_id: '00000000-0000-4000-8000-000000000001', email: 'ui-test@example.test',
    });
    await route.fulfill({ status: failDeletion ? 500 : 200, json: failDeletion ? { error: 'Firebase deletion failed' } : { message: 'Account deleted successfully' } });
  });
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.goto('/profile');
  await page.getByRole('button', { name: copy.profile.deleteAccount.title, exact: true }).click();
  expect(deletionCalls).toBe(0);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(copy.profile.deleteAccount.confirmation)).toBeVisible();
  await dialog.getByRole('button', { name: copy.profile.deleteAccount.title, exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(copy.profile.deleteAccount.failed);
  await expect(page).toHaveURL(/\/profile$/);
  expect(await page.evaluate(() => localStorage.getItem('homeId'))).toBe('00000000-0000-4000-8000-000000000001');
  failDeletion = false;
  await dialog.getByRole('button', { name: copy.profile.deleteAccount.title, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(deletionCalls).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem('homeId'))).toBeNull();
});

test('rejects a revoked backend session and returns to sign-in', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  await mockApi(page, language);
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.route('**/api/v1/profiles', route => route.fulfill({ status: 401, json: { error: 'revoked' } }));
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('homeId'))).toBeNull();
});

test('refreshes expiring ID tokens through the Firebase SDK', async ({ page }, info) => {
  const language = info.project.name.split('-')[0];
  const copy = language === 'tr' ? tr : en;
  await mockApi(page, language, { expireInitialToken: true });
  let refreshRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).hostname === 'securetoken.googleapis.com') refreshRequests++;
  });
  await page.goto('/login');
  await page.getByLabel(copy.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(copy.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  expect(refreshRequests).toBeGreaterThan(0);
});
