'use client';

import posthog from 'posthog-js';
import React, { useEffect } from 'react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init('phc_uCYdZcw8yqa6iJttQmXpuAiNp3FTykGCeM6cPKJNSrxN', {
      api_host: 'https://us.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
    });
  }, []);

  return <>{children}</>;
}
