This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Firebase authentication

Authentication follows backend [PR #140](https://github.com/Chak-and-Jules/home-inventory-backend/pull/140), merged as `7ed08dfa08ccef749fdb43ece8f08a748b64f48b`. The Cloud Run web server passes its four public Firebase/backend container variables to the browser at request time; follow the [Cloud Run deployment guide](docs/cloud-run.md) to set them on a revision and authorize its Firebase domain. For local development, copy `.env.example` to `.env.local` and supply the Firebase web app's public API key, auth domain, and project ID. Firebase/backend runtime settings override old browser build values. Missing Firebase configuration disables sign-in with a translated error. Never add Admin SDK credentials or service account keys to the frontend.

Enable Email/Password and Google in Firebase Authentication and add the deployed web domain to Authorized domains. Google uses the Firebase SDK popup flow and requires popups to be allowed. Provider conflicts ask users to sign in with their original provider; accounts are not linked automatically by email.

Every backend request waits for Firebase auth restoration and obtains `user.getIdToken()` from the SDK, which refreshes expired tokens. No bearer token is copied into application state. A backend 401 or an invalid/revoked SDK session signs the user out; failed mutations are not replayed automatically. Transient token retrieval failures stop the request without signing the user out.

After sign-in, `/profiles/sync` receives the Firebase UID and email. The actual server response uses `ID` and `Email` (the OpenAPI Profile schema still documents lowercase fields). The internal profile UUID is held separately as `profileId`; it is never substituted for `user.uid`. Homes load after sync so first sign-in can create the default home. A failed sync leaves authenticated content unavailable. Sign-out, session loss, and confirmed deletion clear profile/home state and query caches.

Profile settings include permanent account deletion with confirmation and a visible retryable error. Both `/profiles/delete-account` and `/account/delete-request` use the common authenticated API client and send the internal UUID as `user_id`, with the Firebase email. Cleanup happens after a successful backend response; the backend owns deletion of the Firebase identity. SDK sign-out cleanup is attempted afterward.

Coordinate release with the backend deployment: Cloud Run must use `FIREBASE_PROJECT_ID=home-inventory-11`, enable Identity Toolkit, and grant its runtime service account `firebaseauth.users.get` and `firebaseauth.users.delete`. The backend must already accept Firebase ID tokens when this client is released. The client uses Firebase authentication and the private backend image API described below.

Live email/password, Google popup, revocation, default-home provisioning, and deletion checks require a coordinated Firebase/backend test deployment. Unit and browser fixtures use fake credentials and do not verify production IAM or provider configuration. Follow the [rollout validation guide](docs/firebase-auth-validation.md).

## Private images

Image storage follows backend [PR #141](https://github.com/Chak-and-Jules/home-inventory-backend/pull/141), merged as `c29c1b584d8728c32f18308b4ccd73ef3c120fb7`. Deploy that backend with its private bucket and Storage/signBlob IAM permissions **before** releasing this client.

The one-hour URL contract follows [PR #142](https://github.com/Chak-and-Jules/home-inventory-backend/pull/142), merged as `c41b3b655d29d9440f56d7a24115cc62efdfe198`; deploy that update to issue new one-hour URLs. See the backend [contract](https://github.com/Chak-and-Jules/home-inventory-backend/blob/c41b3b655d29d9440f56d7a24115cc62efdfe198/openapi.json) and [integration guide](https://github.com/Chak-and-Jules/home-inventory-backend/blob/c41b3b655d29d9440f56d7a24115cc62efdfe198/README.md#private-image-storage).

Uploads, signing, and deletion use the shared authenticated API client with a fresh Firebase ID token and explicit `X-Home-Id`. The browser sets the multipart boundary for the single `file` field. The UI accepts JPEG/PNG up to 5 MiB and resizes to fit 400 × 400; the backend validates content and enforces 5 MiB/20 MP limits. Upload-capacity failures ask the user to wait at least one second before retrying; mutations are never automatically replayed.

Only the server-generated object key is saved in `image_url`. Creates/updates remove a newly uploaded object if saving fails. Replacements/removals save the SQL reference first, then delete the old object. Definition deletion also precedes object cleanup. Cleanup failures are visible and do not undo a successful save.

Newly issued URLs last approximately one hour after backend PR #142 is deployed. Previously issued 15-minute URLs keep their original deadline. The client uses each response's `expires_at` rather than a fixed lifetime, so both work during rollout.

Signed URLs stay in memory, scoped to Firebase UID and home, refresh one minute before `expires_at`, and disappear at expiry if refresh fails. Requests deduplicate keys and use batches of at most 100; 404 batches are split to isolate missing objects. Home changes cancel/remove old image queries; sign-out/account changes clear all query caches. No signed URL is persisted in localStorage or SQL. Images use direct browser `<img>` requests and an accessible preview, avoiding the Next.js optimization cache. CSP allows `https://storage.googleapis.com` for images; missing or failed images show a translated fallback.

Supabase configuration, bucket initialization, and SDK dependencies have been removed. Existing Supabase objects/SQL references are not migrated or deleted: they show an unavailable-image fallback until replaced with a new upload. Plan any data migration separately. Validate production owner/editor, viewer, cross-home, expiry, and cleanup behavior using the [image rollout checklist](docs/private-images-validation.md).

## Quantities and units

The web client follows the contract merged in backend [PR #138](https://github.com/Chak-and-Jules/home-inventory-backend/pull/138), verified at merge commit `1746d7dc9fedb0e508f53206d27a8e6e228c295b`. The final review added backend tests without changing production code or OpenAPI. Coordinate release with that backend change and its fresh database; no client-side data backfill is performed.

Stock, thresholds, targets, linked shopping amounts, maintenance dependencies, recipe requirements, and prediction amounts use family base units. `SizeUnit.Family`, `FactorToBase`, and `base_size_unit_id` identify compatible choices and conversions. Inventory displays use the entry override when present, otherwise the definition default. Raw base amounts are never labelled with a different display unit.

Inventory forms and quick edits keep the input unit independent from the saved display preference. Input-unit switches preserve the represented amount. Saves use `PATCH /inventory/{id}` with only changed fields: omitted overrides are preserved, `null` restores inheritance, and an explicit ID remains explicit even when equal to the default. Display-only edits omit quantity and expiry. Quantity inputs include `quantity_unit_id`; barcode changes remain signed deltas and prediction application remains a deduction.

`quantityUnits.ts` uses exact integer arithmetic for conversion and validation before the JSON number boundary. The contract supports six fractional base-unit digits and amounts up to 1,000,000,000 base units. For example, `0.000000001 kg` represents `0.000001 g`. Quantity fields use decimal text inputs so native number controls cannot round their value on blur. Decimal points and commas are accepted without thousands separators; `QuantityValue` handles localized presentation. The shared catalog cache also supports explicit receipt-unit confirmation. Receipt prices and unlinked shopping counts keep their existing independent meanings; unlinked counts must also satisfy the six-decimal-place and 1,000,000,000 quantity limits.

Predictive restock suggestions use the unmet target shortage first, then the unmet low-stock threshold shortage, then one definition unit. Every shortage is calculated in base units before presentation or submission. Automatic shopping-list updates triggered by backend stock changes remain controlled by the backend's separate policy.

Older catalogs without conversion metadata keep the unit controls read-only and retain their existing quantity request semantics during rollout. The recipe UI is being delivered separately; shared recipe request/response types include the new unit fields and response casing.

## Getting Started

Install packages:

```bash
pnpm install
```

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Google Cloud Run

The web service is `homeinv-web` in `us-central1`, with a separate Cloud Run backend and Firebase Authentication in `home-inventory-11`. See the [Cloud Run deployment guide](docs/cloud-run.md) for source-build configuration, Firebase authorized domains, backend invocation/IAM requirements, and release checks.


## Guided setup and tutorials

The reusable guide system starts with `introduction` (logical revision 1).
After the backend catalog publishes it, both existing and newly registered users
receive one invitation in a relevant dashboard, inventory, or item-definition
context. The client uses the merged `client_version: 2` renderer contract and filters
the catalog to locally implemented guide variants. The native
and web checkpoints differ; this app uses `welcome → definition → stock → dashboard`.

The introduction explains homes, definitions versus stock, units, and optional
categories. It can reuse existing definitions or stock. New users can create a
minimal definition, then add stock with that saved definition already selected,
and finish on the real dashboard. A failed stock save retains the definition.
Viewers get a read-only explanatory path. Every write uses the selected home's
`X-Home-Id` and the existing quantity conversion contract.

Progress is stored in the backend per account and logical guide. Checkpoints and
24-hour **Maybe later** deferrals are platform-specific. **Finish** and **Skip**
suppress the guide across both platforms, including an app never opened before.
**Restore** in Profile → Tutorials reopens only this app's variant and persists
through reload or sign-in; finishing/skipping again propagates to both apps.
Routine copy/layout changes use content versions and never reset progress. An explicit
logical revision bump is required to reintroduce a completed guide. Adding a
future guide requires a backend catalog entry and a registered client variant;
unsupported variants are filtered out. Discovery uses the array-shaped
`GET /guides?platform=web|mobile&client_version=2` response. Lifecycle commands use
`step_id` and `maybe_later`/`defer_until`; atomic definition/stock selection and
creation use `POST /guides/introduction/setup`. Both endpoints share the backend
progress aggregate and request receipts introduced in backend PR #146; PR #147
adds only setup references, viewer support and atomic saves. A demo home is separate work in web #192.

Deploy the backend guide tables/routes before either client. Requests use
revision and expected-version checks plus stable UUID idempotency keys. A stale
response refreshes progress without replaying a write. A retry of an accepted
create cannot create a duplicate definition or stock entry.

Before release, verify against a deployed backend with the same account on both
apps: independent partial checkpoints, deferral, completion/skip before opening
the other app, same-platform Restore after a fresh sign-in, and subsequent shared
completion/skip. Check EN/TR, keyboard/screen-reader labels, empty/existing homes,
viewer access, and an interrupted stock save. Unit and mocked browser tests do
not establish deployed Firebase/backend configuration or physical-device behavior.
