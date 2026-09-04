1.  **Replace `Array.some` with a `Set` in `useMemo` for category grouping in `src/app/page.tsx`**:
    *   Currently, when calculating `hierarchicalCategoryOptions` in `src/app/page.tsx`, there is an `Array.some` lookup being performed in a loop (`!options.some((o) => o.id === cat.ID)`). This results in an O(N^2) operation, making the loop slower than necessary for larger arrays.
    *   By maintaining a `Set` of the added category IDs, the lookup can be optimized from O(N) to O(1), improving the overall loop from O(N^2) to O(N).
    *   This is a safe change that reduces unnecessary iterations in a frequently run client-side loop, directly improving performance when dealing with larger lists of categories on the main dashboard.

2.  **Verify the fix**:
    *   Run `npx tsc --noEmit`, `npm run lint`, and `npx vitest run` to verify no regressions were introduced.
    *   Verify the app builds.

3.  **Perform pre-commit checks**:
    *   Run all the pre-commit instructions to ensure testing, verifications, reviews, and reflections are complete.

4.  **Submit**:
    *   Commit the change to a new branch, highlighting the performance improvement.
