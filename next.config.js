const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Webpack configuration for Solana and crypto libraries
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // @solana/spl-account-compression@0.4.1 ships a broken exports field
    // (./dist/cjs/index.js — file doesn't exist; actual entry is
    // ./dist/cjs/src/index.js). Webpack respects the exports field strictly,
    // so we alias around it. Remove this once the package publishes a fix.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@solana/spl-account-compression': path.resolve(
        __dirname,
        'node_modules/@solana/spl-account-compression/dist/cjs/src/index.js'
      ),
    };

    // Handle Web Workers
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      loader: 'worker-loader',
      options: {
        filename: 'static/[hash].worker.js',
        publicPath: '/_next/'
      }
    });

    return config;
  },
  
  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
    ORDINALS_API_URL: process.env.ORDINALS_API_URL || 'https://ordinals.com',
  },
  
  // Image optimization configuration
  images: {
    domains: ['ordinals.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

