import * as Sentry from '@sentry/nextjs';

// Client-side Sentry init — runs in the browser
// Replaces the deprecated sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Tracing — capture all transactions (lower to 0.1 in high-traffic prod)
  tracesSampleRate: 1.0,

  // Session Replay — 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  debug: process.env.NODE_ENV === 'development',
  environment: process.env.NODE_ENV,
});

// Instrument App Router client-side navigations for tracing
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

