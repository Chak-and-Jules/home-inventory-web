export function fullPageRedirect(path: string) {
  try {
    // Prevent Open Redirect: ensure the resulting origin matches the current origin
    // This is more robust than string manipulation, and handles backslashes, etc.
    const url = new URL(path, window.location.origin);

    if (url.origin === window.location.origin) {
      window.location.href = url.href;
    } else {
      window.location.href = '/';
    }
  } catch (e) {
    // Fallback if URL parsing fails (e.g. invalid URL)
    window.location.href = '/';
  }
}
