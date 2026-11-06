import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicRuntimeConfig, PUBLIC_RUNTIME_CONFIG_ID } from './runtime-config';
import { getServerRuntimeConfig, serializeRuntimeConfig } from './runtime-config.server';

const runtime = {
  apiUrl: 'https://runtime-backend.example.test/api/v1',
  firebaseApiKey: 'runtime-web-key',
  firebaseAuthDomain: 'runtime.firebaseapp.com',
  firebaseProjectId: 'runtime-project',
};
function inject(value: unknown) {
  const element = document.createElement('script');
  element.id = PUBLIC_RUNTIME_CONFIG_ID;
  element.type = 'application/json';
  element.textContent = JSON.stringify(value);
  document.head.append(element);
  return element;
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://build-backend.example.test/api/v1');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'build-web-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'build.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'build-project');
});
afterEach(() => {
  document.getElementById(PUBLIC_RUNTIME_CONFIG_ID)?.remove();
  vi.unstubAllEnvs();
});

describe('public runtime configuration', () => {
  it('exposes only the four allowlisted public values from the container', () => {
    const config = getServerRuntimeConfig({
      NEXT_PUBLIC_API_URL: runtime.apiUrl,
      NEXT_PUBLIC_FIREBASE_API_KEY: runtime.firebaseApiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: runtime.firebaseAuthDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: runtime.firebaseProjectId,
      PRIVATE_TEST_VALUE: 'must-not-reach-the-browser',
      GOOGLE_APPLICATION_CREDENTIALS: '/private/credentials.json',
      NEXT_PUBLIC_OTHER_VALUE: 'also-not-allowlisted',
    });
    expect(config).toEqual(runtime);
    expect(serializeRuntimeConfig(config)).not.toContain('must-not-reach-the-browser');
    expect(serializeRuntimeConfig(config)).not.toContain('credentials');
  });
  it('reads the current server environment when invoked rather than during import', () => {
    expect(getServerRuntimeConfig().firebaseProjectId).toBe('build-project');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'new-container-project');
    expect(getServerRuntimeConfig().firebaseProjectId).toBe('new-container-project');
  });
  it('uses the server-rendered configuration over stale build values', () => {
    inject(runtime);
    expect(getPublicRuntimeConfig()).toEqual(runtime);
  });
  it('preserves empty runtime Firebase settings rather than restoring stale build credentials', () => {
    inject({ ...runtime, firebaseApiKey: '', firebaseProjectId: '' });
    expect(getPublicRuntimeConfig().firebaseApiKey).toBe('');
    expect(getPublicRuntimeConfig().firebaseProjectId).toBe('');
  });
  it('supports consumers without a server-rendered document using build configuration', () => {
    expect(getPublicRuntimeConfig().firebaseProjectId).toBe('build-project');
  });
  it('reports malformed configuration through the localized auth error path', () => {
    inject(runtime).textContent = '{invalid';
    expect(() => getPublicRuntimeConfig()).toThrow('Invalid public runtime configuration');
    try { getPublicRuntimeConfig(); } catch (error) {
      expect(error).toMatchObject({ code: 'auth/configuration-missing' });
    }
  });
  it('keeps script-closing text and Unicode separators inside JSON data', () => {
    const value = { ...runtime, firebaseApiKey: '</script><script id="injected">alert(1)</script>\u2028\u2029' };
    const json = serializeRuntimeConfig(value);
    expect(json).not.toContain('<');
    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');
    expect(JSON.parse(json)).toEqual(value);
    document.head.insertAdjacentHTML('beforeend', `<script type="application/json" id="${PUBLIC_RUNTIME_CONFIG_ID}">${json}</script>`);
    expect(document.getElementById('injected')).toBeNull();
    expect(getPublicRuntimeConfig()).toEqual(value);
  });
});
