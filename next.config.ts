import type { NextConfig } from 'next';
import { withAxiomNextConfig } from 'next-axiom';

const firebaseAuthOrigin = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ? new URL(`https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`).origin
  : '';

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cloud.umami.is https://apis.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  frame-src 'self' ${firebaseAuthOrigin};
  upgrade-insecure-requests;
  connect-src 'self' http://localhost:8080 https://*.run.app https://*.supabase.co https://cloud.umami.is wss://*.supabase.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ${firebaseAuthOrigin};
`

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ];
  },
};

export default withAxiomNextConfig(nextConfig);
