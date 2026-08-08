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

## 2026-08-08 - [UI Redressing via Error Parameter Reflection]
**Vulnerability:** The application was vulnerable to UI redressing and potential phishing by directly decoding and displaying arbitrary text from the `error_description` or `error` URL query parameters into the UI state during authentication flows (login and signup).
**Learning:** This existed because the application attempted to directly display the error message provided by the authentication provider (Supabase) via URL parameters to the user without validation or sanitization, assuming these parameters were safe and controlled. An attacker could craft a malicious link with a deceptive `error_description` (e.g., `?error_description=Your%20session%20expired.%20Please%20log%20in%20at%20http://evil.com`) to mislead the user.
**Prevention:** To prevent UI redressing and phishing vulnerabilities in authentication flows, never decode and reflect arbitrary text from URL parameters directly into the UI state. Always use securely mapped translation keys or generic static fallback error messages (e.g., 'Authentication failed. Please try again.').
