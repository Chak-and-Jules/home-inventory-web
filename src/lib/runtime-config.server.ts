import type { PublicRuntimeConfig } from './runtime-config';

// Access through the environment object prevents Next.js from freezing these
// NEXT_PUBLIC_* values during compilation. Only this allowlist reaches HTML.
export function getServerRuntimeConfig(environment: Record<string, string | undefined> = process.env): PublicRuntimeConfig {
  return {
    apiUrl: environment.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
    firebaseApiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    firebaseAuthDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  };
}

export function serializeRuntimeConfig(config: PublicRuntimeConfig): string {
  // A closing script tag in an environment value must remain JSON data.
  return JSON.stringify(config).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
