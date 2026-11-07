# Private image rollout validation

Deploy backend PR #141 for private image storage and PR #142 for the one-hour
URL lifetime. The current merged contract is
`c41b3b655d29d9440f56d7a24115cc62efdfe198`. Confirm its private bucket,
Storage Object User permission, signing identity, and signBlob permission are
configured. No Supabase settings, service account key, or bucket CORS change is
needed in the browser. Do not migrate or delete existing Supabase objects as
part of this client release.

## Automated evidence

- Unit tests cover Firebase authentication, explicit home headers despite a
  different localStorage selection, multipart files, 100-key batching,
  deduplication, missing-object isolation, permission/provider/busy responses,
  cancellation, refresh/expiry for both 15-minute and one-hour URLs, mixed
  deadlines and renewal during rollout, account/home/logout isolation, and image
  save ordering/rollback/cleanup failures.
- Playwright fixtures cover upload → object key save → reload with direct GCS
  image URL → inline replacement → clear in English/Turkish at desktop/mobile
  widths. They verify the browser's multipart boundary and read/upload-denial
  behavior for a viewer. Fixtures do not verify real provider IAM or membership.

## Disposable deployment checks

Use a test home and test users with owner, editor, and viewer roles.

1. As owner and editor, upload a JPEG/PNG (up to 5 MiB), save a new definition,
   and reload. Check `POST /images` includes Firebase bearer auth, `X-Home-Id`,
   and exactly one multipart `file`. SQL `image_url` must contain the returned
   `<home UUID>/<image UUID>.jpg|png` key.
2. Confirm the signed URL batch includes same-home keys only and returns
   `expires_at`. After backend PR #142 is deployed, verify a newly issued
   deadline is approximately 60 minutes after the signing request. The browser
   must request GCS directly, with no `/_next/image`
   proxy and no signed URLs in localStorage. Open the full image preview.
3. Leave the page open through the returned one-hour deadline. Confirm refresh
   occurs about one minute before `expires_at` (normally minute 59). Previously
   issued 15-minute URLs retain their original deadline: verify those refresh
   around minute 14, then use the new one-hour deadline after renewal. Mixed
   batches must expire independently. Suspend the tab and return after expiry.
   If signing is unavailable, expired URLs must become unavailable-image
   placeholders at their own returned deadline.
4. As viewer, read images successfully. Attempts to upload or delete must be
   rejected with 403. Copy a key into another home's signing/delete request;
   the backend must reject it without accessing that object. Switch homes and
   accounts and sign out: no old image URL should remain in the rendered UI or
   React Query cache.
5. Replace an image, then clear it. Confirm SQL updates precede `DELETE /images`
   and the previous object is removed. Repeat after deleting a definition.
   Force a definition-save failure after upload: only the new object should be
   removed, with the previous reference/object preserved.
6. Verify missing objects, signing/provider failure, and disabled storage display
   placeholders or translated retryable errors. A busy upload (503 with
   `Retry-After: 1`) asks the user to wait; no mutation is replayed automatically.
   Failed cleanup must show a warning: reconcile any orphaned objects using
   backend tooling after checking current SQL references.
7. Legacy Supabase paths show unavailable images until replaced. Confirm a new
   upload replaces the SQL key without attempting GCS deletion of the legacy
   path. Plan any bulk migration separately.

These live checks require a coordinated test deployment and have not been run
by the local automated fixtures.
