## 2024-05-18 - [Security Headers]
**Vulnerability:** Missing basic security headers
**Learning:** Next.js applications require manual configuration in next.config.ts to apply basic security headers like Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, etc.
**Prevention:** Always add a headers() function to next.config.ts when initializing a new Next.js project to apply these standard protections globally.
