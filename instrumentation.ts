import * as Sentry from '@sentry/nextjs';

// Server + Edge Sentry init — called by Next.js instrumentation hook
// Replaces the deprecated sentry.server.config.ts & sentry.edge.config.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js server
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime (middleware, edge API routes)
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV,
    });
  }
}

// Propagate server-side errors to Sentry (App Router)
export const onRequestError = Sentry.captureRequestError;
