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
  title: 'TeleCheck Pro | Telegram Link Validator',
  description:
    'Validate Telegram links in bulk, review saved links, and browse validation results in a polished dashboard.',
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
    title: 'TeleCheck Pro | Telegram Link Validator',
    description:
      'Validate Telegram links in bulk, inspect metadata, and separate valid, invalid, and Mega links — all in a sleek dashboard.',
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
    title: 'TeleCheck Pro | Telegram Link Validator',
    description:
      'Validate Telegram links in bulk, inspect metadata, and separate valid, invalid, and Mega links.',
    images: ['/og-image.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
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
