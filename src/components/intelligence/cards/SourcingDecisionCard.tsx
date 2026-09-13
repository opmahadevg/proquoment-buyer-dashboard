'use client';

import React, { useState } from 'react';
import { Target, HelpCircle, CheckCircle, AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';
import { ScoreFactor } from '@/lib/intelligence/core';

interface Props {
  data: {
    recommendation: string;
    sourcingScore: number;
    scoreMethodology: string;
    scoreFactors: ScoreFactor[];
    primaryOrigin: string;
    keyAdvantages: string[];
    keyRisks: string[];
    criticalUnknowns: string[];
    nextSteps: string[];
  };
  onViewEvidence?: () => void;
  onCreateRFQ?: () => void;
}

export const SourcingDecisionCard: React.FC<Props> = ({ data, onViewEvidence, onCreateRFQ }) => {
  const [showAudit, setShowAudit] = useState(false);

  const isStrong = data.sourcingScore >= 75;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Target className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Procurement Assessment & Sourcing Verdict
            </h4>
            <p className="text-xs text-zinc-500">Deterministic scoring & operational risk evaluation</p>
          </div>
        </div>
        <EvidenceBadge classification="calculated" sourceName="Procurement Decision Engine" onClick={onViewEvidence} />
      </div>

      {/* Main Verdict Box */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500 font-medium">Strategic Recommendation</div>
          <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 capitalize">
            Source from <span className="text-indigo-600 dark:text-indigo-400">{data.primaryOrigin}</span> (
            {data.recommendation.replace('_', ' ')})
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Deterministic evaluation validates high market demand, favorable FTA zero-duty status, and competitive landed costs.
          </p>
        </div>

        <div className="sm:text-right shrink-0">
          <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {data.sourcingScore}<span className="text-sm font-normal text-zinc-400">/100</span>
          </div>
          <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
            Overall Sourcing Score
          </div>
        </div>
      </div>

      {/* "Why?" Interactive Audit Button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAudit(!showAudit)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Why this score? View factor breakdown</span>
          {showAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAudit && (
          <div className="mt-3 p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 space-y-2 animate-in fade-in duration-200">
            <div className="text-[11px] text-zinc-500 italic mb-2">
              {data.scoreMethodology}
            </div>
            {data.scoreFactors.map((factor) => (
              <div key={factor.name} className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/40 dark:border-zinc-700/40 last:border-0">
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {factor.name} <span className="text-zinc-400 font-normal">({(factor.weight * 100).toFixed(0)}% weight)</span>
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {factor.score}/100 <span className="text-[10px] text-zinc-500 font-normal">(+{factor.contribution} pts)</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advantages & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1.5 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Key Strategic Advantages
          </div>
          <ul className="space-y-1 text-emerald-950 dark:text-emerald-300">
            {data.keyAdvantages.slice(0, 3).map((adv, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
          <div className="font-semibold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Critical Unknowns & Risks
          </div>
          <ul className="space-y-1 text-amber-950 dark:text-amber-300">
            {data.criticalUnknowns.slice(0, 2).map((risk, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Call to Action: RFQ Pre-fill */}
      {onCreateRFQ && (
        <button
          type="button"
          onClick={onCreateRFQ}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
        >
          <span>Create Sourcing Brief & Pre-fill RFQ</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
