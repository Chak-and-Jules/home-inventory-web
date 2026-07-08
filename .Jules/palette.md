## 2024-07-08 - Added loading states and updated input styles in Home Users Management
**Learning:** Adding loading spinners to async buttons provides critical feedback to users, preventing duplicate clicks. Also using consistent components (Input, Select, Button, Label) over native html inputs improves general application styling.
**Action:** Always verify custom components instead of plain html are used and `mutation.isPending` is properly handled in interactive list and form elements to avoid duplicate submissions.
