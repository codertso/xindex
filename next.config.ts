
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ["twitter-api-v2"], // Removed puppeteer
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push('@napi-rs/canvas');
    }
    return config;
  },
};

export default nextConfig;
