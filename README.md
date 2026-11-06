This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Firebase authentication

Authentication follows backend [PR #140](https://github.com/Chak-and-Jules/home-inventory-backend/pull/140), merged as `7ed08dfa08ccef749fdb43ece8f08a748b64f48b`. The Cloud Run web server passes its four public Firebase/backend container variables to the browser at request time; follow the [Cloud Run deployment guide](docs/cloud-run.md) to set them on a revision and authorize its Firebase domain. For local development, copy `.env.example` to `.env.local` and supply the Firebase web app's public API key, auth domain, and project ID. Firebase/backend runtime settings override old browser build values. Missing Firebase configuration disables sign-in with a translated error. Never add Admin SDK credentials or service account keys to the frontend.

Enable Email/Password and Google in Firebase Authentication and add the deployed web domain to Authorized domains. Google uses the Firebase SDK popup flow and requires popups to be allowed. Provider conflicts ask users to sign in with their original provider; accounts are not linked automatically by email.

Every backend request waits for Firebase auth restoration and obtains `user.getIdToken()` from the SDK, which refreshes expired tokens. No bearer token is copied into application state. A backend 401 or an invalid/revoked SDK session signs the user out; failed mutations are not replayed automatically. Transient token retrieval failures stop the request without signing the user out.

After sign-in, `/profiles/sync` receives the Firebase UID and email. The actual server response uses `ID` and `Email` (the OpenAPI Profile schema still documents lowercase fields). The internal profile UUID is held separately as `profileId`; it is never substituted for `user.uid`. Homes load after sync so first sign-in can create the default home. A failed sync leaves authenticated content unavailable. Sign-out, session loss, and confirmed deletion clear profile/home state and query caches.

Profile settings include permanent account deletion with confirmation and a visible retryable error. Both `/profiles/delete-account` and `/account/delete-request` use the common authenticated API client and send the internal UUID as `user_id`, with the Firebase email. Cleanup happens after a successful backend response; the backend owns deletion of the Firebase identity. SDK sign-out cleanup is attempted afterward.

Coordinate release with the backend deployment: Cloud Run must use `FIREBASE_PROJECT_ID=home-inventory-11`, enable Identity Toolkit, and grant its runtime service account `firebaseauth.users.get` and `firebaseauth.users.delete`. The backend must already accept Firebase ID tokens when this client is released. The client has no fallback to Supabase authentication. Supabase remains for the existing image Storage integration, which also obtains Firebase ID tokens. Configure third-party Firebase auth/RLS on that service before relying on protected image uploads or signed URLs, or deliver the storage migration separately.

Live email/password, Google popup, revocation, default-home provisioning, and deletion checks require a coordinated Firebase/backend test deployment. Unit and browser fixtures use fake credentials and do not verify production IAM or provider configuration. Follow the [rollout validation guide](docs/firebase-auth-validation.md).

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
