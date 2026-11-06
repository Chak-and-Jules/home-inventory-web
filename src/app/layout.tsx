import type { Metadata } from 'next';
import Script from 'next/script';
import { AxiomWebVitals } from 'next-axiom';
import { Inter } from 'next/font/google';
import { connection } from 'next/server';
import { PUBLIC_RUNTIME_CONFIG_ID } from '@/lib/runtime-config';
import { getServerRuntimeConfig, serializeRuntimeConfig } from '@/lib/runtime-config.server';
import './globals.css';

import Providers from './providers';
import { AppLayout } from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Talo Box',
  description: 'Manage your home inventory with ease and a spark.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cloud Run provides these variables when the container starts, after build.
  await connection();
  const publicConfig = getServerRuntimeConfig();
  return (
    <html lang="en">
      <AxiomWebVitals />
      <head>
        <script
          id={PUBLIC_RUNTIME_CONFIG_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serializeRuntimeConfig(publicConfig) }}
        />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID !== "disabled-for-local-development" && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || "https://cloud.umami.is/script.js"}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${inter.className} min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased`}>
        <Providers>
          <AppLayout>
            {children}
          </AppLayout>
        </Providers>
      </body>
    </html>
  );
}
