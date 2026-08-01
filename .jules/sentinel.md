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
## 2026-08-01 - Prevent UI Redressing / Text Injection in Auth Error Handlers
**Vulnerability:** The login and signup pages directly used `decodeURIComponent` on `error_description` URL parameters and injected the resulting text into the React state to display as an error message without validation.
**Learning:** This allowed an attacker to create phishing links with arbitrary messages (e.g., `?error_description=Your+account+has+been+deleted.+Please+contact+support.`) that would look authentic because they are rendered within the application's native UI alert components, exploiting user trust.
**Prevention:** Never decode and blindly reflect untrusted inputs directly into the UI state. Always validate against a known set of error codes/messages, or use a static, generic fallback error string (like "Authentication failed. Please try again.") to ensure no arbitrary text can be injected.
