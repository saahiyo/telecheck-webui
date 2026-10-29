import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['http://localhost:3000', '172.29.96.1'],
  devIndicators: false,
  turbopack: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'firebase/app': path.resolve(process.cwd(), 'node_modules/firebase/app/dist/esm/index.esm.js'),
      'firebase/auth': path.resolve(process.cwd(), 'node_modules/firebase/auth/dist/esm/index.esm.js'),
    };
    return config;
  },
};

export default nextConfig;
