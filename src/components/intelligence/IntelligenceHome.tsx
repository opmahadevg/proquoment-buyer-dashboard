'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  ShieldCheck,
  Compass,
  FolderKanban,
  History,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { IntelligenceChatInput } from './IntelligenceChatInput';
import { ResearchDepth } from '@/lib/intelligence/core';
import { useIntelligenceStore, IntelligenceAttachment } from '@/lib/intelligence/store';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onStart?: (query: string, depth: ResearchDepth, attachments?: IntelligenceAttachment[]) => void;
}

export const IntelligenceHome: React.FC<Props> = ({ onStart }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { resetElicitation, setActiveSession, addMessage } = useIntelligenceStore(user?.id);

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [userSessions, setUserSessions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadUserData() {
      if (!user?.id) {
        setWorkspaces([]);
        setUserSessions([]);
        setLoadingHistory(false);
        return;
      }
      setLoadingHistory(true);
      try {
        const [wsRes, sessRes] = await Promise.all([
          fetch(`/api/intelligence/workspaces?buyerId=${user.id}`).then((r) => r.json()).catch(() => ({ workspaces: [] })),
          fetch(`/api/intelligence/sessions?buyerId=${user.id}`).then((r) => r.json()).catch(() => ({ sessions: [] })),
        ]);
        if (isMounted) {
          setWorkspaces(wsRes.workspaces || []);
          setUserSessions(sessRes.sessions || []);
        }
      } catch (err) {
        console.error('Failed to load user intelligence data:', err);
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    }

    loadUserData();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleStartResearch = (
    query: string,
    depth: ResearchDepth,
    attachments?: IntelligenceAttachment[]
  ) => {
    const newSessionId = `sess_${Date.now()}`;
    setActiveSession(newSessionId);
    resetElicitation(newSessionId);

    if (attachments && attachments.length > 0) {
      addMessage(newSessionId, {
        id: `msg_user_${Date.now()}`,
        sessionId: newSessionId,
        role: 'user',
        content: query,
        attachments,
        createdAt: new Date().toISOString(),
      });
    }

    if (onStart) {
      onStart(query, depth, attachments);
    } else {
      const encoded = encodeURIComponent(query);
      router.push(`/intelligence/research?session=${newSessionId}&q=${encoded}&depth=${depth}`);
    }
  };

  // Determine user name
  const rawName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.first_name ||
    (user?.email ? user.email.split('@')[0] : 'demo');
  const userName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Buyer';

  // Greeting
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) return 'Good Morning';
    if (hours >= 12 && hours < 17) return 'Good Afternoon';
    if (hours >= 17 && hours < 22) return 'Good Evening';
    return 'Good Morning';
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 scroll-smooth selection:bg-zinc-900 selection:text-white">
      {/* SECTION 1: Above the fold (Full initial viewport height) */}
      <div className="min-h-[calc(100vh-56px)] flex flex-col justify-between px-4 sm:px-6 md:px-12 py-8 md:py-10 max-w-4xl mx-auto">
        {/* Top Header: Good Morning with user name, then Question */}
        <div className="pt-6 sm:pt-10 md:pt-14 text-center space-y-2">
          <p className="text-sm md:text-base font-normal text-zinc-500 dark:text-zinc-400 tracking-normal">
            {getGreeting()}, <span className="font-semibold text-zinc-900 dark:text-zinc-100">{userName}</span>
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 font-sans">
            What product are we sourcing today?
          </h1>
        </div>

        {/* Center breathing space pushing chat to lower section */}
        <div className="flex-1 min-h-[40px] md:min-h-[70px]" />

        {/* Lower Section of the Page: Chat input */}
        <div className="w-full pb-6 md:pb-10">
          <IntelligenceChatInput onSend={handleStartResearch} variant="home" />
        </div>
      </div>

      {/* SECTION 2: All further information under it after the scroll */}
      <div id="further-info" className="border-t border-zinc-200/60 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/30 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-12 py-16 space-y-12">
          {/* Section Header */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Institutional Intelligence Core
            </h2>
            <p className="text-base md:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Deterministic calculations, customs registries, and real-time compliance
            </p>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
              Real-time trade flow analysis, customs unit values, WTO compliance prerequisites, and verified supplier matchmaking across India, China, and global hubs.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Official Customs Data</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Bilateral volume, CAGR, and historical trade unit values directly from UN Comtrade v2.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Compliance & Tariffs</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Applied MFN and FTA preferential tariffs with WTO ePing sanitary and technical barriers.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                <Compass className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Deterministic Scoring</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Transparent 8-factor sourcing scores and landed cost models. Code calculates, AI reasons.
              </p>
            </div>
          </div>

          {/* Workspaces & Recent Inquiries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Active Workspaces */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Active Workspaces</h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {loadingHistory ? 'Loading...' : `${workspaces.length} active`}
                </span>
              </div>

              {loadingHistory ? (
                <div className="space-y-2 py-2">
                  <div className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                  <div className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                </div>
              ) : workspaces.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30">
                  <FolderKanban className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No active workspaces yet</p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                    Start researching a product above to generate an institutional sourcing workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {workspaces.map((ws: any) => (
                    <Link
                      key={ws.id}
                      href={`/intelligence/workspace/${ws.id}`}
                      className="block p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {ws.product_name || ws.name || 'Sourcing Workspace'}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {ws.hs_code ? `HS ${ws.hs_code} · ` : ''}
                            {Array.isArray(ws.origin_countries)
                              ? ws.origin_countries.join(', ')
                              : (ws.destination_country || 'Global')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Score {ws.sourcing_score || ws.score || 85}/100
                          </div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {ws.status === 'active' ? 'Ready for RFQ' : ws.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Inquiries */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Inquiries</h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {loadingHistory ? 'Loading...' : `${userSessions.length} inquiries`}
                </span>
              </div>

              {loadingHistory ? (
                <div className="space-y-2 py-2">
                  <div className="h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                  <div className="h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 animate-pulse" />
                </div>
              ) : userSessions.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30">
                  <History className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No recent inquiries</p>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                    Your past sourcing inquiries and research queries will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userSessions.slice(0, 5).map((sess: any) => (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => router.push(`/intelligence/research?session=${sess.id}`)}
                      className="w-full text-left p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition flex items-center justify-between text-xs group"
                    >
                      <div className="truncate pr-3">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-950 dark:group-hover:text-white">
                          {sess.title || 'Sourcing Inquiry'}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {sess.created_at
                            ? new Date(sess.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : sess.date || 'Recent'}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
