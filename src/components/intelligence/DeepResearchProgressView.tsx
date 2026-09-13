'use client';

import React from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { ResearchState } from '@/lib/intelligence/core';

interface Props {
  state: ResearchState;
  progressPercent: number;
  message?: string;
  activeTool?: string;
}

export const DeepResearchProgressView: React.FC<Props> = ({
  state,
  progressPercent,
  message,
  activeTool,
}) => {
  const steps = [
    { label: 'Analyzing product parameters & specifications', done: progressPercent >= 15 },
    { label: 'Classifying HS code & modeling logistics corridors', done: progressPercent >= 30 },
    { label: 'Benchmarking customs CIF records & trade demand', done: progressPercent >= 55 },
    { label: 'Evaluating tariff treaties & compliance mandates', done: progressPercent >= 75 },
    { label: 'Executing deterministic landed cost & sourcing scoring', done: progressPercent >= 90 },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl p-5 shadow-sm border border-zinc-200/90 dark:border-zinc-800 my-4 transition-all">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              Procurement Intelligence Research
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block">
              Verifying customs tariffs, landed costs & compliance
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs">
          <span>{progressPercent}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-4">
        <div
          className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
        />
      </div>

      {/* Current Step Status */}
      {message && (
        <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium mb-4 p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
          </span>
          <span className="truncate">{message}</span>
        </div>
      )}

      {/* Step checklist */}
      <div className="space-y-2.5 text-xs">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            {s.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0" />
            )}
            <span className={s.done ? 'text-zinc-800 dark:text-zinc-200 font-medium' : 'text-zinc-400 dark:text-zinc-500'}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
