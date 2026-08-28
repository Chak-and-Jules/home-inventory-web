## 2024-05-18 - [Security Headers]
**Vulnerability:** Missing basic security headers
**Learning:** Next.js applications require manual configuration in next.config.ts to apply basic security headers like Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, etc.
**Prevention:** Always add a headers() function to next.config.ts when initializing a new Next.js project to apply these standard protections globally.

## 2026-07-04 - Open Redirect Vulnerability in Navigation
**Vulnerability:** Found an Open Redirect vulnerability in `src/lib/navigation.ts` where `fullPageRedirect(path)` assigned user-provided paths directly to `window.location.href` without validation.
**Learning:** This existed because client-side redirects were implemented directly using the native Window interface without considering that relative path inputs could actually be absolute paths or protocol-relative paths (like `//malicious.com`).
**Prevention:** Always validate that redirect paths assigned to `window.location.href` are strictly relative (starting with `/` but not `//`) or explicitly match the application's expected origin to prevent attackers from redirecting users to malicious sites.

## 2026-07-11 - Missing Content-Security-Policy Header
**Vulnerability:** The application was missing a `Content-Security-Policy` header in `next.config.ts`, exposing users to XSS, clickjacking, and data injection attacks.
**Learning:** Security headers must be explicitly configured in Next.js via the `headers()` function in `next.config.ts`.
**Prevention:** Ensure new Next.js projects have a restrictive CSP enabled by default, while whitelisting necessary external assets (like Supabase and analytics).

## 2026-08-28 - UI Redressing / Phishing in Authentication Error Messages
**Vulnerability:** The application was vulnerable to UI redressing / phishing attacks on the `/login` and `/signup` pages due to unvalidated `error` and `error_description` URL parameters being decoded and reflected directly into the UI state (`setError(decodeURIComponent(errorDesc))`). An attacker could trick users by supplying malicious text like "Authentication failed. Please use our new site at https://evil.com".
**Learning:** React escapes HTML automatically, preventing traditional XSS, but reflecting arbitrary text from URL parameters can still be used for phishing and social engineering in critical flows like authentication.
**Prevention:** Never decode and reflect arbitrary text from URL parameters into the UI state. Always use securely mapped translation keys or generic static fallback error messages (e.g., 'Authentication failed. Please try again.').
