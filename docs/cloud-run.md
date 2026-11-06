# Cloud Run deployment

The production web service is `homeinv-web` in `us-central1`, using Firebase project `home-inventory-11`:

- Web: https://homeinv-web-459154861005.us-central1.run.app
- Backend API: https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1
- Firebase auth domain: home-inventory-11.firebaseapp.com

## Frontend source builds

The checked-in `.env.production` contains only the four public browser settings supplied for this deployment. Next.js reads it automatically during `next build`, including source builds from a connected GitHub repository. The Firebase web API key is a public client identifier. Private credentials must stay outside this file.

Merge the configuration change, then trigger a new source build/deployment of `homeinv-web` from the updated main branch. The existing deployed image cannot pick up these settings without rebuilding. Cloud Run's runtime Variables & Secrets alone cannot replace browser values that Next.js already compiled into JavaScript.

`.gitignore` and `.gcloudignore` explicitly include `.env.production` in source uploads while excluding local env files and dependencies/build output. If the connected build uses a custom source filter, make sure it also includes `.env.production`.

Existing build environment variables take precedence over `.env.production`, including variables set to empty strings. Remove empty/stale overrides for `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, or set them to the values in that file. Keep unrelated build/runtime settings intact. Local development still uses `.env.local` and the existing localhost defaults; test fixtures override production settings.

For a manual source deployment, run from a fresh checkout of this repository's updated main branch in Cloud Shell:

```sh
gcloud projects describe home-inventory-11 --format='value(projectNumber)'
# Confirm the project number is 459154861005, matching the service URLs.
gcloud run deploy homeinv-web \
  --source . \
  --project home-inventory-11 \
  --region us-central1
```

The deploy command intentionally does not replace service environment variables, service accounts, or IAM policies. Prefer the existing connected GitHub deployment when it is already configured. Next.js's start command reads Cloud Run's `PORT` environment variable.

## Firebase Authentication

In Firebase Console, select `home-inventory-11`, then Authentication → Settings → Authorized domains. Add this hostname without a scheme, path, or trailing slash:

```text
homeinv-web-459154861005.us-central1.run.app
```

Enable Email/Password and Google under Authentication → Sign-in method. The frontend web configuration and backend `FIREBASE_PROJECT_ID` must point to the same Firebase project. No Firebase Admin/service-account key belongs in the frontend.

## Backend Cloud Run service

The browser calls the backend directly with a Firebase ID token. Its Cloud Run endpoint must accept public HTTPS invocation so requests reach the backend's Firebase middleware. A Cloud Run IAM invoker requirement would reject these Firebase client tokens before application authentication runs. Check the existing service's security settings rather than replacing its IAM policy blindly.

The backend runtime must have `FIREBASE_PROJECT_ID=home-inventory-11`. Its runtime service account needs `firebaseauth.users.get` and `firebaseauth.users.delete` in that project; enable the Identity Toolkit API. Existing Cloud SQL and Secret Manager access must be preserved. Use Application Default Credentials from that service account.

The repository's backend CORS middleware already accepts `Authorization`, `Content-Type`, and `X-Home-Id`. A read-only preflight check from Cloud Shell is:

```sh
curl --include --request OPTIONS \
  'https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1/profiles/sync' \
  --header 'Origin: https://homeinv-web-459154861005.us-central1.run.app' \
  --header 'Access-Control-Request-Method: POST' \
  --header 'Access-Control-Request-Headers: authorization,content-type,x-home-id'
```

Expect HTTP 204 with the matching CORS allow headers. A platform-generated 403 indicates an invocation/ingress restriction. To inspect the configured runtime identity without printing credentials:

```sh
gcloud run services describe home-inventory-backend-us \
  --project home-inventory-11 \
  --region us-central1 \
  --format='value(spec.template.spec.serviceAccountName)'
```

## Verify the release

Open the web URL in a private window after the new revision receives traffic. Confirm the configuration error is gone. Sign in and check that requests use the backend HTTPS URL ending in `/api/v1`, including `/profiles/sync`, rather than localhost. Returning sign-ins should retain the internal profile UUID and existing home. Complete the disposable-user checks in [firebase-auth-validation.md](firebase-auth-validation.md).

The retained Supabase image Storage integration still requires its own public URL/key and Firebase third-party auth/RLS configuration. These are separate from the sign-in/backend settings above.
