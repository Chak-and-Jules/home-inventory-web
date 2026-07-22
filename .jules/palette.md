## 2026-06-20 - Interactive elements for file inputs
**Learning:** When hiding `<input type="file">` to customize file upload UIs, you must use a semantic `<button>` element (or equivalent component) instead of a generic `div` as the trigger. If a `div` is used, the element drops out of the accessibility tree, making it impossible for keyboard users to interact with it since it receives no focus.
**Action:** Always wrap custom file upload trigger logic in `<button type="button">` and ensure it has an appropriate `aria-label` and `focus-visible` styling.

## 2026-07-01 - Loading States on Destructive/Critical Actions
**Learning:** Adding explicit, inline visual feedback (like a loading spinner replacing the action icon) directly to action buttons (like a Logout button) during asynchronous operations prevents user uncertainty and duplicate clicks, while adhering to common accessibility best-practices by clearly communicating a change in state via the `disabled` attribute alongside the visual queue.
**Action:** When working on asynchronous submit/action elements, always swap out the icon for a spinner or append a spinner and pair it with `disabled={isLoading}` state on the button element.

## 2026-07-08 - Added loading states and updated input styles in Home Users Management
**Learning:** Adding loading spinners to async buttons provides critical feedback to users, preventing duplicate clicks. Also using consistent components (Input, Select, Button, Label) over native html inputs improves general application styling.
**Action:** Always verify custom components instead of plain html are used and `mutation.isPending` is properly handled in interactive list and form elements to avoid duplicate submissions.

## 2026-07-21 - Added aria-labels to icon-only buttons
**Learning:** Found that generic buttons using `size="icon"` with only an SVG child component often miss an accessible name, reducing screen reader compatibility, but they are common pattern in list views like `MaintenanceTaskList.tsx`. Hardcoded labels or translated labels need to be correctly placed depending on context.
**Action:** Ensure all icon-only buttons always include an explicit `aria-label` attribute, either directly or translated via `t()`, to ensure accessibility across list actions.
