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