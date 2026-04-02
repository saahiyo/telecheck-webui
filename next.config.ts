import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['http://localhost:3000', '172.29.96.1'],
};

export default nextConfig;
