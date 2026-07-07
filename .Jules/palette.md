## 2026-06-20 - Interactive elements for file inputs
**Learning:** When hiding `<input type="file">` to customize file upload UIs, you must use a semantic `<button>` element (or equivalent component) instead of a generic `div` as the trigger. If a `div` is used, the element drops out of the accessibility tree, making it impossible for keyboard users to interact with it since it receives no focus.
**Action:** Always wrap custom file upload trigger logic in `<button type="button">` and ensure it has an appropriate `aria-label` and `focus-visible` styling.

## 2026-07-01 - Loading States on Destructive/Critical Actions
**Learning:** Adding explicit, inline visual feedback (like a loading spinner replacing the action icon) directly to action buttons (like a Logout button) during asynchronous operations prevents user uncertainty and duplicate clicks, while adhering to common accessibility best-practices by clearly communicating a change in state via the `disabled` attribute alongside the visual queue.
**Action:** When working on asynchronous submit/action elements, always swap out the icon for a spinner or append a spinner and pair it with `disabled={isLoading}` state on the button element.
