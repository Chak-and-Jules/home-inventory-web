export const PUBLIC_RUNTIME_CONFIG_ID = 'app-runtime-config';

export type PublicRuntimeConfig = {
  apiUrl: string;
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
};

// The server-rendered document takes precedence over build-time browser values,
// including when a runtime value is empty. Never restore stale build credentials.
export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const element = typeof document === 'undefined' ? null : document.getElementById(PUBLIC_RUNTIME_CONFIG_ID);
  if (element) {
    try {
      const value = JSON.parse(element.textContent || '{}');
      const text = (key: keyof PublicRuntimeConfig) => typeof value?.[key] === 'string' ? value[key] : '';
      return {
        apiUrl: text('apiUrl'),
        firebaseApiKey: text('firebaseApiKey'),
        firebaseAuthDomain: text('firebaseAuthDomain'),
        firebaseProjectId: text('firebaseProjectId'),
      };
    } catch {
      throw Object.assign(new Error('Invalid public runtime configuration'), { code: 'auth/configuration-missing' });
    }
  }

  // Standalone component tests and local consumers without a rendered document.
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  };
}
