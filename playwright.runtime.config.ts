import { defineConfig } from '@playwright/test';

// Production regression: build without deployment settings, then provide them
// only to the running server, just as Cloud Run configures a container revision.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'runtime-config.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
  },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_API_URL: 'https://runtime-backend.example.test/api/v1',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'runtime-web-key-only-at-container-start',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'runtime-fixture.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'runtime-fixture',
      RUNTIME_CONFIG_PRIVATE_TEST_VALUE: 'private-marker-must-never-reach-html',
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'disabled-for-local-development',
    },
  },
});
