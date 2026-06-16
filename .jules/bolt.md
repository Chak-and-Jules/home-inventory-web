## 2024-06-16 - [Supabase Signed URLs vs Public URLs]
**Learning:** Using `createSignedUrls` for lists of images creates an unnecessary network request waterfall which blocks rendering and adds overhead. The `AGENTS.md` notes that we should pre-calculate the public URL prefix and concatenate.
**Action:** Replaced asynchronous `useSignedUrls` hook with a synchronous `getImageUrl` utility that concatenates the path with a module-level pre-calculated bucket URL prefix to eliminate the network call and avoid layout shifts.
