import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  use: {
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    trace: 'off',
  },
  projects: ['en', 'tr'].flatMap((language) => [
    {
      name: `${language}-desktop`,
      use: { locale: language, viewport: { width: 1440, height: 900 } },
    },
    {
      name: `${language}-mobile`,
      use: { locale: language, viewport: { width: 390, height: 844 } },
    },
  ]),
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'disabled-for-local-development',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'fake-api-key-for-browser-fixtures',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-home-inventory.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-home-inventory',
    },
  },
});
