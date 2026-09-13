'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { IntelligenceHome } from '@/components/intelligence/IntelligenceHome';
import { useIntelligenceStore } from '@/lib/intelligence/store';
import { ResearchDepth } from '@/lib/intelligence/core';

export default function IntelligencePage() {
  const router = useRouter();
  const { setActiveSession, resetElicitation } = useIntelligenceStore();

  const handleStartResearch = (query: string, depth: ResearchDepth = 'standard') => {
    const newSessionId = `sess_${Date.now()}`;
    setActiveSession(newSessionId);
    resetElicitation(newSessionId);
    const encoded = encodeURIComponent(query);
    router.push(`/intelligence/research?q=${encoded}&session=${newSessionId}&depth=${depth}`);
  };

  return (
    <AppLayout>
      <div className="w-full h-full min-h-[calc(100vh-56px)] bg-zinc-50/50 dark:bg-zinc-950 flex flex-col">
        <IntelligenceHome onStart={handleStartResearch} />
      </div>
    </AppLayout>
  );
}
