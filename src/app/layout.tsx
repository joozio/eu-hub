import type { Metadata, Viewport } from 'next';
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';
import { MobileBottomNav } from '@/components/Navigation';
import { RootLayoutClient } from './RootLayoutClient';
import { ThemeProvider } from './ThemeProvider';
import { assertEnv } from '@/lib/env';

assertEnv();

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-body',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'EU Hub – The European Union, Made Personal',
  description: 'Your personalized gateway to EU legislation, statistics, and policies. Real Eurostat data, AI-powered insights, personalized by country and age.',
  keywords: ['EU', 'European Union', 'Eurostat', 'EU legislation', 'EU statistics', 'EU news'],
  authors: [{ name: 'EU Hub' }],
  openGraph: {
    title: 'EU Hub – The European Union, Made Personal',
    description: 'Personalized EU news, statistics, and legislation for every EU citizen.',
    type: 'website',
    locale: 'en_EU',
    siteName: 'EU Hub',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EU Hub – The European Union, Made Personal',
    description: 'Personalized EU news, statistics, and legislation for every EU citizen.',
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EU Hub',
  },
};

export const viewport: Viewport = {
  themeColor: '#003399',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('eu-hub-theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (t === 'system' && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={`${dmSans.className} ${dmSans.variable} ${plusJakarta.variable}`}>
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        <ThemeProvider>
          <RootLayoutClient>
            <Navigation />
            <div id="main-content" className="md:pb-0 pb-20">
              {children}
            </div>
            <MobileBottomNav />
          </RootLayoutClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
