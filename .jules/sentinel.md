## 2024-05-18 - [Security Headers]
**Vulnerability:** Missing basic security headers
**Learning:** Next.js applications require manual configuration in next.config.ts to apply basic security headers like Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, etc.
**Prevention:** Always add a headers() function to next.config.ts when initializing a new Next.js project to apply these standard protections globally.

## 2026-07-04 - Open Redirect Vulnerability in Navigation
**Vulnerability:** Found an Open Redirect vulnerability in `src/lib/navigation.ts` where `fullPageRedirect(path)` assigned user-provided paths directly to `window.location.href` without validation.
**Learning:** This existed because client-side redirects were implemented directly using the native Window interface without considering that relative path inputs could actually be absolute paths or protocol-relative paths (like `//malicious.com`).
**Prevention:** Always validate that redirect paths assigned to `window.location.href` are strictly relative (starting with `/` but not `//`) or explicitly match the application's expected origin to prevent attackers from redirecting users to malicious sites.
