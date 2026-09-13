'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { IntelligenceChatInput } from './IntelligenceChatInput';
import { IntelligenceChatMessage } from './IntelligenceChatMessage';
import { DeepResearchProgressView } from './DeepResearchProgressView';
import { IntelligenceMessageItem, IntelligenceAttachment, useIntelligenceStore } from '@/lib/intelligence/store';
import { ResearchDepth, ResearchState } from '@/lib/intelligence/core';
import { useAuth } from '@/contexts/AuthContext';

const THINKING_STATES = [
  'Understanding your sourcing requirements',
  'Analyzing product specifications',
  'Querying customs trade records',
  'Checking import regulatory mandates',
  'Modeling landed cost and origin rankings',
];

function TypingIndicator({ message }: { message?: string }) {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % THINKING_STATES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 py-3 mb-6 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
      <span>{message || THINKING_STATES[textIndex]}</span>
      <div className="flex items-center gap-1 ml-1 mt-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  sessionId?: string;
  initialQuery?: string;
  onBack?: () => void;
}

export const IntelligenceChat: React.FC<Props> = ({
  sessionId: propSessionId,
  initialQuery,
  onBack,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const {
    messages,
    getMessages,
    addMessage,
    updateCardData,
    isStreaming,
    setStreaming,
    activeSessionId,
    setActiveSession,
    elicitationState,
    setElicitationState,
    resetElicitation,
    upsertSession,
  } = useIntelligenceStore(user?.id);

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return propSessionId || activeSessionId || `sess_${Date.now()}`;
  });

  const targetSessionId = propSessionId || currentSessionId || activeSessionId || '';
  const sessionMessages = (getMessages && targetSessionId) ? getMessages(targetSessionId) : [];
  const activeMessages = sessionMessages.length > 0 ? sessionMessages : messages;

  const [researchProgress, setResearchProgress] = useState<{
    state: ResearchState;
    percent: number;
    message: string;
  }>({
    state: 'completed',
    percent: 100,
    message: '',
  });

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propSessionId) {
      setActiveSession(propSessionId);
      setCurrentSessionId(propSessionId);
    }
  }, [propSessionId, setActiveSession]);

  // Hydrate messages from Supabase API if opening a saved session and not yet loaded in store
  useEffect(() => {
    if (!propSessionId) return;

    const existing = getMessages ? getMessages(propSessionId) : [];
    if (existing.length === 0) {
      const buyerParam = user?.id ? `?buyerId=${user.id}` : '';
      fetch(`/api/intelligence/sessions/${propSessionId}${buyerParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            data.messages.forEach((dbMsg: any) => {
              addMessage(propSessionId, {
                id: dbMsg.id,
                sessionId: propSessionId,
                role: dbMsg.role,
                content: dbMsg.content,
                cards: dbMsg.structured_data || [],
                suggestedActions: dbMsg.suggested_actions || [],
                createdAt: dbMsg.created_at,
                attachments: dbMsg.metadata?.attachments || [],
              });
            });
          }
        })
        .catch((err) => console.error('Error hydrating session history:', err));
    }
  }, [propSessionId, user?.id, getMessages, addMessage]);

  useEffect(() => {
    if (activeMessages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeMessages.length]);

  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialSentRef.current && !isStreaming) {
      initialSentRef.current = true;
      const existingUserMsg = activeMessages.find(
        (m) => m.role === 'user' && m.sessionId === targetSessionId && m.attachments && m.attachments.length > 0
      );
      handleSend(initialQuery, 'standard', existingUserMsg?.attachments, Boolean(existingUserMsg));
    }
  }, [initialQuery, isStreaming, targetSessionId, activeMessages]);

  const handleSend = async (
    query: string,
    depth: ResearchDepth,
    attachments?: IntelligenceAttachment[],
    skipAddingUserMessage = false
  ) => {
    if ((!query.trim() && (!attachments || attachments.length === 0)) || isStreaming) return;

    if (!skipAddingUserMessage) {
      const userMsg: IntelligenceMessageItem = {
        id: `msg_user_${Date.now()}`,
        sessionId: currentSessionId,
        role: 'user',
        content: query,
        attachments,
        createdAt: new Date().toISOString(),
      };
      setActiveSession(currentSessionId);
      addMessage(currentSessionId, userMsg);
    }

    setStreaming(true, 'understanding');
    setResearchProgress({
      state: 'understanding',
      percent: 10,
      message: attachments && attachments.length > 0 ? 'Analyzing attached documents and specifications...' : '',
    });

    try {
      const response = await fetch('/api/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sessionId: currentSessionId,
          buyerId: user?.id || 'buyer_anon_01',
          depth,
          conversationHistory: activeMessages.map((m) => ({ role: m.role, content: m.content })),
          elicitationState: elicitationState || undefined,
          attachments,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to Intelligence stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let assistantContent = '';
      let structuredCards: any[] = [];
      let suggestedActions: any[] = [];
      let receivedAttachmentAnalysis: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === 'research_status') {
                setResearchProgress({
                  state: data.state || 'researching',
                  percent: data.progressPercent || 50,
                  message: data.message || '',
                });
              } else if (currentEvent === 'attachment_analysis') {
                receivedAttachmentAnalysis = data;
              } else if (currentEvent === 'tool_started') {
                setResearchProgress((prev) => ({
                  ...prev,
                  percent: Math.max(prev.percent, data.progressPercent || prev.percent),
                  message: data.description || `Querying ${data.tool}...`,
                }));
              } else if (currentEvent === 'assistant_chunk') {
                assistantContent = data.content || '';
              } else if (currentEvent === 'structured_data') {
                structuredCards = data.cards || [];
              } else if (currentEvent === 'suggested_actions') {
                suggestedActions = data.actions || [];
              } else if (currentEvent === 'elicitation_state') {
                setElicitationState(data, currentSessionId);
              } else if (currentEvent === 'done') {
                const assistantMsg: IntelligenceMessageItem = {
                  id: data.messageId || `msg_asst_${Date.now()}`,
                  sessionId: currentSessionId,
                  role: 'assistant',
                  content: assistantContent,
                  cards: structuredCards,
                  suggestedActions,
                  attachmentAnalysis: receivedAttachmentAnalysis,
                  createdAt: new Date().toISOString(),
                };
                addMessage(currentSessionId, assistantMsg);

                // Upsert session into Recent Inquiries with derived metadata
                const briefingCard = structuredCards.find((c: any) => c.type === 'sourcing_briefing');
                const specCard = structuredCards.find((c: any) => c.type === 'spec_clarification');
                const product = briefingCard?.data?.productProfile?.name || specCard?.data?.inferredProduct || query.slice(0, 32);
                const destination = briefingCard?.data?.marketSnapshot?.destinationCountry || '';
                const sessionTitle = destination ? `${product} → ${destination}` : product;
                const score = briefingCard?.data?.feasibilityIndex?.overallScore || 85;

                upsertSession({
                  id: currentSessionId,
                  title: sessionTitle,
                  productName: product,
                  destination,
                  score,
                  date: 'Just now',
                });
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }
    } catch (err: any) {
      addMessage(currentSessionId, {
        id: `msg_err_${Date.now()}`,
        sessionId: currentSessionId,
        role: 'assistant',
        content: `**Research Notice:** Temporary issue connecting to data providers (${err?.message || 'Network error'}). Please try again.`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setStreaming(false, 'completed');
      setResearchProgress({ state: 'completed', percent: 100, message: '' });
    }
  };

  const handleCreateRFQ = (customBrief?: any) => {
    if (customBrief) {
      const p = customBrief.productProfile || {};
      const m = customBrief.marketSnapshot || {};
      const origins = customBrief.recommendedOrigins || [];
      const lc = customBrief.landedCostTable || {};
      const certs = (customBrief.complianceChecklist || [])
        .map((c: any) => c.item)
        .join(', ');

      const query = new URLSearchParams({
        prefill: 'true',
        product_name: p.name || '',
        category: p.category || '',
        hs_code: p.hsCode || '',
        order_quantity: p.orderQuantity || '',
        material_grade: p.materialGrade || '',
        packaging: p.packaging || '',
        dimensions: p.dimensions || '',
        destination: m.destinationCountry || '',
        origin: origins[0]?.country || 'China',
        target_fob: lc.basePriceUSD ? String(lc.basePriceUSD) : '',
        target_landed: lc.totalLandedPerUnitUSD ? String(lc.totalLandedPerUnitUSD) : '',
        certifications: certs,
        notes: customBrief.buyerNotes || '',
      }).toString();

      router.push(`/new-product?${query}`);
    } else {
      router.push('/new-product');
    }
  };

  const handleBack = () => {
    setActiveSession(null);
    resetElicitation();
    if (onBack) {
      onBack();
    } else {
      router.push('/intelligence');
    }
  };

  const isDeepResearching =
    isStreaming &&
    researchProgress.state !== 'intake' &&
    researchProgress.state !== 'understanding' &&
    researchProgress.percent > 20;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-56px)] bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Top Header — Clean, minimal like RFQ Builder */}
      <header className="px-6 py-3.5 border-b border-gray-100 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer py-1 px-2 -ml-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Back to Intelligence Home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-[#0D0D14] dark:text-zinc-100">
              Sourcing Advisor
            </h2>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area — Centered column 30% wider (max-w-4xl) */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-8 pb-4">
          {activeMessages.length === 0 && (
            <div className="py-20 text-center max-w-md mx-auto">
              <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-zinc-900 text-zinc-400 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#0D0D14] dark:text-zinc-100 mb-1">
                Where would you like to source today?
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Describe any product, material, or destination. Proquoment guides your sourcing strategy with verified customs data and tariff modeling.
              </p>
            </div>
          )}

          {activeMessages.map((msg) => (
            <IntelligenceChatMessage
              key={msg.id}
              role={msg.role as any}
              content={msg.content}
              attachments={msg.attachments}
              attachmentAnalysis={msg.attachmentAnalysis}
              cards={msg.cards}
              suggestedActions={msg.suggestedActions}
              onActionClick={(prompt) => handleSend(prompt, 'standard')}
              onCreateRFQ={handleCreateRFQ}
              onUpdateBriefing={(cardId, updated) => updateCardData(currentSessionId, cardId, updated)}
            />
          ))}

          {/* Smooth Typing Indicator for conversational intake */}
          {isStreaming && !isDeepResearching && (
            <TypingIndicator message={researchProgress.message} />
          )}

          {/* Progress View only for deep institutional research phase */}
          {isDeepResearching && (
            <DeepResearchProgressView
              state={researchProgress.state}
              progressPercent={researchProgress.percent}
              message={researchProgress.message}
            />
          )}
        </div>
      </div>

      {/* Chat Input Container — Centered, 30% wider matching chat area */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
        <div className="max-w-4xl mx-auto">
          <IntelligenceChatInput onSend={handleSend} disabled={isStreaming} variant="chat" />
        </div>
      </div>
    </div>
  );
};
