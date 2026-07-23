import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import AppLayout from '@/components/AppLayout';
import DatabuddyAnalytics from '@/components/DatabuddyAnalytics';
import SWRegistration from '@/components/SWRegistration';

const themeInitScript = `
  (() => {
    try {
      const storedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = storedTheme === 'dark' || (!storedTheme && prefersDark) ? 'dark' : 'light';
      const themeColor = theme === 'dark' ? '#020617' : '#f8fafc';

      document.documentElement.classList.toggle('dark', theme === 'dark');

      let meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }

      meta.setAttribute('content', themeColor);
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: 'TeleCheck Pro | Bulk Telegram Link Validator & Checker',
  description:
    'Free bulk Telegram link validator. Check if Telegram channels, groups, and invite links are valid or dead. Detect invalid, expired, and Mega.nz links instantly.',
  keywords: [
    'telegram link validator',
    'telegram link checker',
    'bulk telegram link check',
    'check telegram channel',
    'telegram invite link checker',
    'telegram group validator',
    'dead link checker telegram',
    'telegram link status',
  ],
  manifest: '/site.webmanifest',
  metadataBase: new URL('https://telecheck-pro.vercel.app'),
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TeleCheck Pro',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'TeleCheck Pro | Bulk Telegram Link Validator & Checker',
    description:
      'Free bulk Telegram link validator. Check if Telegram channels, groups, and invite links are valid or dead. Detect invalid, expired, and Mega.nz links instantly.',
    url: 'https://telecheck-pro.vercel.app',
    siteName: 'TeleCheck Pro',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TeleCheck Pro — Bulk Telegram Link Validator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TeleCheck Pro | Bulk Telegram Link Validator & Checker',
    description:
      'Free bulk Telegram link validator. Check if Telegram channels, groups, and invite links are valid or dead.',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'zTLUc1pHJB0CD4rwlXovCOpqGxarVHd5u3Fy_nBhi3s',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'TeleCheck Pro',
  url: 'https://telecheck-pro.vercel.app',
  description:
    'Validate Telegram links in bulk, inspect metadata, and separate valid, invalid, and Mega links — all in a sleek dashboard.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Bulk Telegram link validation',
    'Single link quick check',
    'Mega.nz link detection',
    'Saved links dashboard',
    'Contributor leaderboard',
    'Link metadata inspection',
  ],
  creator: {
    '@type': 'Organization',
    name: 'TeleCheck Pro',
    url: 'https://telecheck-pro.vercel.app',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SWRegistration />
        <DatabuddyAnalytics />
        <AppLayout>
          {children}
        </AppLayout>
        <Analytics />
      </body>
    </html>
  );
}
