## 2026-06-20 - Interactive elements for file inputs
**Learning:** When hiding `<input type="file">` to customize file upload UIs, you must use a semantic `<button>` element (or equivalent component) instead of a generic `div` as the trigger. If a `div` is used, the element drops out of the accessibility tree, making it impossible for keyboard users to interact with it since it receives no focus.
**Action:** Always wrap custom file upload trigger logic in `<button type="button">` and ensure it has an appropriate `aria-label` and `focus-visible` styling.
## 2026-06-22 - Granular loading states for list items
**Learning:** When using React Query to perform asynchronous operations on lists (like deleting a row), disabling the entire list or showing a global spinner creates a jarring experience. At the same time, providing no feedback can lead to multiple destructive requests.
**Action:** Always use `mutation.isPending && mutation.variables === itemId` to target the specific row being modified. Disable the action button and replace its icon with an inline spinner (`<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>`) for optimal UX feedback.
