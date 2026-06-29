## 2025-02-23 - Prevent Open Redirect Vulnerability
**Vulnerability:** The `fullPageRedirect` function allowed redirecting to arbitrary domains if user-supplied paths were ever passed to it.
**Learning:** `window.location.href = path` without validation poses a risk. Also, simply checking for `path.startsWith('/')` is insufficient because it permits `//attacker.com` (protocol-relative URLs) which bypass the check and redirect offsite.
**Prevention:** Always validate redirect targets by ensuring the path matches the expected origin (`window.location.origin`) or is strictly relative to the current site (e.g., `path.startsWith('/') && !path.startsWith('//')`).
