import { withSentryConfig } from '@sentry/nextjs';
import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
  },

  // Fix HTTP 431: Supabase auth JWT cookies can be 20KB+ across chunks.
  // NODE_OPTIONS=--max-http-header-size=65536 is set in .env.local for persistent effect.
  httpAgentOptions: {
    keepAlive: true,
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry org & project
  org: 'proquoment',
  project: 'javascript-nextjs',

  // Suppress noisy build output (show in CI)
  silent: !process.env.CI,

  // Upload source maps for readable stack traces in Sentry
  widenClientFileUpload: true,

  // v10 replacements for deprecated options
  webpack: {
    treeshake: {
      removeDebugLogging: true, // replaces disableLogger
    },
  },
});