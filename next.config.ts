import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@erp-ai/sdk', 'ws'],
};

export default nextConfig;
