import type { Metadata } from 'next';
import Script from 'next/script';
import { AxiomWebVitals } from 'next-axiom';
import { Inter } from 'next/font/google';
import './globals.css';

import Providers from './providers';
import { AppLayout } from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Talo Box',
  description: 'Manage your home inventory with ease and a spark.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <AxiomWebVitals />
      <head>
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
