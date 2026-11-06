import { test, expect } from '@playwright/test';
import en from '../src/lib/i18n/locales/en/common.json';
import { mockApi } from './mock-api';

test('uses container-start settings for Firebase, API requests, and CSP in a production build', async ({ page }) => {
  await mockApi(page, 'en');
  const response = await page.goto('/login');
  expect(response?.headers()['content-security-policy']).toContain('frame-src \'self\' https://runtime-fixture.firebaseapp.com;');
  expect(response?.headers()['content-security-policy']).toContain('https://runtime-backend.example.test');
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(await response!.text()).not.toContain('private-marker-must-never-reach-html');
  await expect(page.getByRole('heading', { name: en.auth.welcomeBack })).toBeVisible();
  await expect(page.getByText(en.auth.configurationMissing)).toHaveCount(0);
  expect(JSON.parse(await page.locator('#app-runtime-config').textContent() || '{}')).toEqual({
    apiUrl: 'https://runtime-backend.example.test/api/v1',
    firebaseApiKey: 'runtime-web-key-only-at-container-start',
    firebaseAuthDomain: 'runtime-fixture.firebaseapp.com',
    firebaseProjectId: 'runtime-fixture',
  });

  const signInRequest = page.waitForRequest(r => r.url().includes('accounts:signInWithPassword'));
  const syncRequest = page.waitForRequest(r => r.url().includes('/api/v1/profiles/sync'));
  await page.getByLabel(en.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(en.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: en.auth.signIn, exact: true }).click();
  expect(new URL((await signInRequest).url()).searchParams.get('key')).toBe('runtime-web-key-only-at-container-start');
  const sync = await syncRequest;
  expect(sync.url()).toBe('https://runtime-backend.example.test/api/v1/profiles/sync');
  expect(sync.headers().authorization).toMatch(/^Bearer /);
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
});

test('runtime security policy also permits SDK token refresh', async ({ page }) => {
  await mockApi(page, 'en', { expireInitialToken: true });
  const refresh = page.waitForRequest(r => new URL(r.url()).hostname === 'securetoken.googleapis.com');
  await page.goto('/login');
  await page.getByLabel(en.auth.emailAddress).fill('ui-test@example.test');
  await page.getByLabel(en.auth.password, { exact: true }).fill('mock-password-only');
  await page.getByRole('button', { name: en.auth.signIn, exact: true }).click();
  await refresh;
  await expect(page.getByRole('heading', { name: 'UI Test Home' })).toBeVisible();
});
