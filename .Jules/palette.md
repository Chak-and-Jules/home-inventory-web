## 2026-08-30 - Form Submit Loading States
**Learning:** For asynchronous submit elements, swapping the action icon (like a Plus) for a spinning Loader2 alongside a disabled state provides much clearer inline visual feedback and prevents duplicate clicks compared to relying purely on changing text.
**Action:** Always swap out action icons for a loading spinner (e.g., Loader2) and pair with disabled={isLoading} on async form submit buttons.
