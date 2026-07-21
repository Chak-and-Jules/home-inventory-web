## 2026-07-21 - Added aria-labels to icon-only buttons
**Learning:** Found that generic buttons using `size="icon"` with only an SVG child component often miss an accessible name, reducing screen reader compatibility, but they are common pattern in list views like `MaintenanceTaskList.tsx`. Hardcoded labels or translated labels need to be correctly placed depending on context.
**Action:** Ensure all icon-only buttons always include an explicit `aria-label` attribute, either directly or translated via `t()`, to ensure accessibility across list actions.
