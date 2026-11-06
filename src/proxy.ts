import { NextResponse } from 'next/server';
import { getServerRuntimeConfig } from './lib/runtime-config.server';
import { contentSecurityPolicy } from './lib/content-security-policy';

export function proxy() {
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(getServerRuntimeConfig()));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = {
  matcher: ['/((?!api(?:/|$)|_next/|.*\\..*).*)'],
};
