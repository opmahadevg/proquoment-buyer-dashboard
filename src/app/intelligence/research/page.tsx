'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { IntelligenceChat } from '@/components/intelligence/IntelligenceChat';
import { useIntelligenceStore } from '@/lib/intelligence/store';

function IntelligenceResearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlQuery = searchParams.get('q') || undefined;
  const sessionId = searchParams.get('session') || undefined;
  const { setActiveSession, resetElicitation } = useIntelligenceStore();

  const handleBack = () => {
    setActiveSession(null);
    resetElicitation();
    router.push('/intelligence');
  };

  return (
    <AppLayout>
      <div className="w-full h-full min-h-[calc(100vh-56px)] bg-white dark:bg-zinc-950 flex flex-col">
        <IntelligenceChat
          sessionId={sessionId}
          initialQuery={urlQuery}
          onBack={handleBack}
        />
      </div>
    </AppLayout>
  );
}

export default function IntelligenceResearchPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-zinc-500">Loading Intelligence Research...</div>}>
      <IntelligenceResearchContent />
    </Suspense>
  );
}
