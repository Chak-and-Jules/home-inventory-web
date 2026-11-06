import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { proxy, config } from './proxy';
import { contentSecurityPolicy } from './lib/content-security-policy';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.custom.example.test/api/v1');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'auth.custom.example.test');
});
afterEach(() => vi.unstubAllEnvs());

describe('runtime response headers', () => {
  it('allows the runtime Firebase iframe and backend origin and prevents stale HTML caching', () => {
    const response = proxy();
    const csp = response.headers.get('Content-Security-Policy')!;
    expect(csp).toContain("frame-src 'self' https://auth.custom.example.test;");
    expect(csp).toContain('https://api.custom.example.test;');
    expect(csp).toContain('https://securetoken.googleapis.com');
    expect(csp).toContain('https://identitytoolkit.googleapis.com');
    expect(csp).toContain('https://apis.google.com');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });
  it('reads header configuration again for a new container environment', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'new-auth.example.test');
    expect(proxy().headers.get('Content-Security-Policy')).toContain('https://new-auth.example.test');
  });
  it('does not permit CSP injection or non-HTTP API schemes', () => {
    const csp = contentSecurityPolicy({ apiUrl: 'javascript:alert(1)', firebaseAuthDomain: "bad domain; script-src *", firebaseApiKey: '', firebaseProjectId: '' });
    expect(csp).not.toContain('javascript:');
    expect(csp).not.toContain('script-src *');
    expect(csp).toContain("frame-src 'self'");
  });
  it.each(['/', '/login', '/profile', '/inventory/edit/uuid'])('applies to page %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });
  it.each(['/_next/static/chunk.js', '/_next/image', '/favicon.ico', '/mockServiceWorker.js', '/image.svg', '/api/config'])('preserves asset/API handling for %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
  });
});
