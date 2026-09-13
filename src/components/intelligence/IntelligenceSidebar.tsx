'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Plus, FolderKanban, MessageSquare, History, ChevronRight } from 'lucide-react';
import { IntelligenceSession, WorkspaceSummary } from '@/lib/intelligence/store';

interface Props {
  sessions: IntelligenceSession[];
  workspaces: WorkspaceSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

export const IntelligenceSidebar: React.FC<Props> = ({
  sessions,
  workspaces,
  activeSessionId,
  onSelectSession,
  onNewChat,
}) => {
  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col h-full shrink-0">
      {/* New Research Button */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Sourcing Research</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Active Workspaces Section */}
        <div>
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Sourcing Workspaces</span>
          </div>
          <div className="space-y-1">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/intelligence/workspace/${ws.id}`}
                className="flex items-center justify-between p-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition group"
              >
                <div className="truncate">
                  <div className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{ws.productName}</div>
                  <div className="text-[10px] text-zinc-500">→ {ws.destinationCountry} (Score: {ws.sourcingScore || 85})</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Chat Sessions Section */}
        <div>
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            <span>Recent Queries</span>
          </div>
          <div className="space-y-1">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => onSelectSession(sess.id)}
                  className={`w-full text-left p-2 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{sess.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
        <span className="text-[11px] text-zinc-400 font-mono">Proquoment AI Intelligence V1</span>
      </div>
    </aside>
  );
};
