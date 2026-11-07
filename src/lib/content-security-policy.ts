import type { PublicRuntimeConfig } from './runtime-config';

function httpOrigin(value: string): string {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin : '';
  } catch {
    return '';
  }
}

export function contentSecurityPolicy(config: PublicRuntimeConfig): string {
  const firebaseOrigin = config.firebaseAuthDomain ? httpOrigin(`https://${config.firebaseAuthDomain}`) : '';
  const apiOrigin = httpOrigin(config.apiUrl);
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cloud.umami.is https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://storage.googleapis.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `frame-src 'self' ${firebaseOrigin}`,
    'upgrade-insecure-requests',
    `connect-src 'self' http://localhost:8080 https://*.run.app https://cloud.umami.is https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ${firebaseOrigin} ${apiOrigin}`,
  ].join('; ') + ';';
}
