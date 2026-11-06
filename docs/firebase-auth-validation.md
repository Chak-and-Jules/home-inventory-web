# Firebase auth rollout checks

Issue: [web #187](https://github.com/Chak-and-Jules/home-inventory-web/issues/187). Server contract: [backend #140](https://github.com/Chak-and-Jules/home-inventory-backend/pull/140), merged at `7ed08dfa08ccef749fdb43ece8f08a748b64f48b`.

The client uses Firebase client SDK ID tokens and keeps Firebase `user.uid` separate from the profile sync response `ID`. The server model returns uppercase `ID`/`Email`; the OpenAPI Profile schema's lowercase properties are stale. No backend or production configuration is changed by this PR.

## Automated verification

- Unit tests cover Firebase email/password registration/sign-in, the Google popup SDK call, lazy configuration, current ID-token retrieval, invalid/transient sessions, authentication changes, authenticated API headers, sync ordering and deduplication, preference loading, both deletion routes, and cache cleanup. Existing API fixtures now supply a fake Firebase identity.
- Playwright uses the real browser Firebase SDK with intercepted identity/token/backend responses. The auth journeys cover persisted sign-in restoration, expiring-token refresh through the SDK, backend 401 sign-out, and deletion confirmation/failure/retry with a separate internal UUID. The existing UI and quantity suites run with the same Firebase fixtures in English and Turkish at desktop/mobile widths.
- Browser fixtures do not validate actual Firebase providers, token signatures, backend provisioning, Cloud Run IAM, or Storage RLS. Google popup completion is covered by the SDK unit boundary, not a live Google account.

Commands:

```sh
pnpm install --frozen-lockfile
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
# Omit this environment variable when using Playwright's installed browser.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test
```

Results on 2026-11-06: all 138 Vitest tests, TypeScript, lint, and the production build passed. Lint retains the two existing unused-variable warnings in receipt handling/navigation. Playwright passed 52 cases in the full run, then all four expiring-token cases passed after correcting the fake refresh endpoint's response field. This covers all 56 current browser cases across four locale/viewport combinations. No failed check remains after these fixes.

The Playwright browser download was denied by the environment's HTTP policy. The installed Chromium executable was used successfully instead.

## Test deployment acceptance

These checks require a coordinated test deployment and disposable test users. They have not been run against the live project in this task.

1. Supply the Firebase web configuration at frontend build time, enable Email/Password and Google, and authorize the web domain. The CSP permits the configured Firebase auth iframe, Google SDK script, and Firebase identity/refresh endpoints.
2. Deploy the Firebase backend with `FIREBASE_PROJECT_ID=home-inventory-11`, Identity Toolkit enabled, and runtime service account permissions `firebaseauth.users.get` and `firebaseauth.users.delete`. Client and server must use the same Firebase project.
3. Register a disposable email/password user. Confirm `/profiles/sync` sends its UID/email and returns a distinct internal UUID, then confirm a default home appears. Sign out and back in; confirm the internal UUID and home are reused. Repeat with Google sign-in.
4. Let an ID token expire and confirm SDK refresh permits an API request. Revoke or disable the disposable user in Firebase and confirm the next authenticated request returns to sign-in without replaying mutations.
5. In the test backend, induce a Firebase deletion failure and confirm the account remains signed in with a visible deletion error. Restore permissions, retry, and confirm both the Firebase identity and SQL data are removed. Confirm the request sends the internal UUID in `user_id`. Verify both authenticated deletion routes.
6. Configure Supabase's Firebase third-party authentication and review Storage RLS before using the retained image Storage integration. Its token callback now uses Firebase and never restores a legacy Supabase session. If Storage is being migrated separately, include that change in the rollout plan.
