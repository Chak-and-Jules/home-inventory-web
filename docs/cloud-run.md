# Cloud Run deployment

The production web service is `homeinv-web` in `us-central1`, using Firebase project `home-inventory-11`:

- Web: https://homeinv-web-459154861005.us-central1.run.app
- Backend API: https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1
- Firebase auth domain: home-inventory-11.firebaseapp.com

## Container runtime configuration

The web server reads these four public settings from the container environment when serving each page. It places an allowlisted JSON configuration in the document for the Firebase SDK and API client, and generates the Content Security Policy from the same runtime URLs. The HTML is dynamically rendered and not cached. Private credentials and unrelated environment variables are never included in that configuration.

| Cloud Run container variable | Production value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | The Firebase web app's public `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `home-inventory-11.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `home-inventory-11` |

In Google Cloud Console → Cloud Run → `homeinv-web` → Edit & deploy new revision → Variables & Secrets, set all four variables and deploy the revision. The API URL must include `/api/v1`; it is separate from the three Firebase values. Missing Firebase values still produce a translated configuration error.

Deploy the runtime-config code from the updated main branch once. After that initial image deployment, these four values can change through container variables and a new revision without rebuilding the image. A hard reload opens the new revision's runtime settings. No `.env.production` file is required, and Firebase values do not need to be available during the image build.

Next.js normally embeds direct `process.env.NEXT_PUBLIC_*` browser references at build time. The server runtime bridge is what makes Cloud Run container settings work for these four values. It takes precedence over any old values in the compiled browser bundle, including deliberately empty runtime Firebase settings. Other public settings, such as analytics and the retained Supabase Storage client, retain their existing build-time behavior. For local development, use `.env.local`; the API still defaults to `http://localhost:8080/api/v1` when no URL is configured.

For a manual initial source deployment, run from a fresh checkout of the updated main branch in Cloud Shell:

```sh
gcloud projects describe home-inventory-11 --format='value(projectNumber)'
# Confirm the project number is 459154861005, matching the service URLs.
gcloud run deploy homeinv-web \
  --source . \
  --project home-inventory-11 \
  --region us-central1
```

Prefer the connected GitHub deployment when it is already configured. Keep the three existing Firebase container variables. To add the backend URL to the existing service without replacing other variables:

```sh
gcloud run services update homeinv-web \
  --project home-inventory-11 \
  --region us-central1 \
  --update-env-vars=NEXT_PUBLIC_API_URL=https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1
```

These commands preserve unrelated service settings and do not replace its IAM policy. Next.js's start command reads Cloud Run's `PORT` environment variable.

## Production runtime regression check

```sh
npm run test:runtime
# For an existing Chromium installation:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:runtime
```

This builds the app and starts it with different deployment values supplied only to the running server. The production browser tests verify runtime Firebase initialization, the exact backend URL and ID-token header, fresh CSP/no-store headers, session restoration, SDK refresh, and exclusion of a private test environment value from HTML. Identity/backend responses are intercepted; the check does not create live accounts or verify production IAM.

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

Open the web URL in a private window after the new revision receives traffic. Confirm the configuration error is gone. The document source should contain an `app-runtime-config` JSON block with the current Firebase project/auth domain and API URL. If that block is absent, the browser is receiving an image from before the runtime-config change; if its Firebase fields are empty, check the environment on the revision receiving traffic. Sign in and check that requests use the backend HTTPS URL ending in `/api/v1`, including `/profiles/sync`, rather than localhost. Returning sign-ins should retain the internal profile UUID and existing home. Complete the disposable-user checks in [firebase-auth-validation.md](firebase-auth-validation.md).

Deploy backend PR #141 with private Cloud Storage and signing IAM permissions before this web revision; deploy PR #142 to issue one-hour image URLs. The client honors each returned `expires_at`, including existing 15-minute URLs during rollout. The frontend needs no Supabase settings, bucket CORS, or storage credentials. Follow [private-images-validation.md](private-images-validation.md) for release validation.
