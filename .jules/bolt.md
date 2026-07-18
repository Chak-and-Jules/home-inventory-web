## 2026-06-17 - Prevent Unnecessary Recalculations and Re-renders with useMemo
**Learning:** Inline array mappings (e.g., `inventory?.map(d => d.ItemDefinition?.ImageURL) || []`) passed as dependencies to custom hooks like `useSignedUrls` create new array references on every render. This forces the hook to re-run expensive calculations, such as sorting (`validPaths.sort()`) and deduplication (`new Set`), leading to performance bottlenecks and UI lag (e.g., during typing in item edit forms).
**Action:** Always wrap derived arrays passed as props or hook dependencies in `useMemo` to ensure stable references. Additionally, use `useMemo` inside custom hooks to memoize derived state calculations (like deduplicating and sorting paths) to prevent O(N log N) work on every render.

## 2026-06-18 - Prevent Unnecessary Context Consumer Re-renders with useMemo
**Learning:** Context Providers passing inline objects as values (e.g., `value={{ user, session, logout }}`) create new object references on every render. Because `HomeProvider` consumes `AuthContext`, a re-render of `AuthProvider` cascades and forces all `HomeContext` consumers to re-render, even if the home-related state hasn't changed. This is a common performance bottleneck in React applications.
**Action:** Always wrap Context values in `useMemo` and memoize provider functions using `useCallback` to ensure stable references are passed down. This prevents widespread, unnecessary re-renders of downstream consumers.

## 2026-06-19 - Prevent Unnecessary Re-creations of Component Constants
**Learning:** Arrays or objects defined within the body of a React component (like a navigation array) create new references on every render. If these objects are passed as props to other components, it can cause unnecessary re-renders. While `useMemo` has a minor overhead, memoizing an array derived from hooks (like `useTranslation`) guarantees a stable reference across renders unless its dependencies change. Note: Keep all hook calls before early returns so React hook order rules are preserved.
**Action:** Wrap arrays or objects declared in a component body with `useMemo` if they don't depend on changing state/props, or if they depend on specific variables like a translation function, to ensure stable references across re-renders.

## 2026-06-29 - Client-side Caching for Long-Lived Signed URLs
**Learning:** Private Supabase buckets using RLS policies cannot be accessed using `getPublicUrl()`; they require `createSignedUrls()`. Generating these URLs on every render or session leads to redundant API calls and latency.
**Action:** When handling private bucket images, fetch signed URLs with a maximum expiration duration (e.g., 1 year) and aggressively cache them locally (e.g., via `localStorage`), ensuring the cache includes expiration timestamps for invalidation. This effectively eliminates recurring network overhead while respecting RLS privacy boundaries.

## 2026-07-03 - Prevent O(N²) Bottleneck in Hierarchical Tree Generation
**Learning:** Using `Array.prototype.filter()` recursively to find child nodes in a flat array (e.g., building a tree from a flat list where elements specify a `ParentID`) causes an O(N²) time complexity. In `src/app/categories/page.tsx`, this approach led to redundant traversals and UI lag when sorting the categories array hierarchically.
**Action:** Replace recursive `.filter` operations with a single-pass O(N) hash map grouping (e.g., `Map<string, Item[]>`). Group the items by their parent keys first, and then traverse the hash map. This reduces complexity to O(N log N) (or O(N) without sorting) and dramatically improves performance for large data sets.

## 2026-07-10 - Prevent O(N) Unnecessary Array Filtering on Keystroke
**Learning:** Inline arrays combined with  and  (e.g., `categories?.filter((c) => c.ID !== editingId).map(...)`) dynamically created inside the render flow of a form input will re-evaluate on every keystroke, forcing unneeded recalculations and potential garbage collection pressure, leading to UI lag when editing elements.
**Action:** Extract derived, filtered lists out of the render loop and wrap them in `useMemo` with specific dependencies (like the current `editingId`) to prevent redundant execution when unrelated form state (like `editName`) updates.

## 2026-07-17 - Prevent Re-renders during Inline Editing
**Learning:** Re-evaluating arrays or objects using `map` or similar methods directly inside the render loop causes new element references to be created on every keystroke when form state updates, significantly slowing down interactive components like forms.
**Action:** Extract inline array maps that render options or lists out of the render loop using `useMemo` so their references remain stable until their dependencies actually change.
