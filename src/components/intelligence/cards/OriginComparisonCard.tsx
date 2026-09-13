'use client';

import React from 'react';
import { Award, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';
import { OriginRecommendation } from '@/lib/intelligence/core';

interface Props {
  data: {
    destinationCountry: string;
    productName: string;
    rankings: OriginRecommendation[];
    recommendation?: string;
  };
  onViewEvidence?: () => void;
  onSelectOrigin?: (country: string) => void;
}

export const OriginComparisonCard: React.FC<Props> = ({ data, onViewEvidence, onSelectOrigin }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
            <Award className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Origin Competitiveness: {data.productName} → {data.destinationCountry}
            </h4>
            <p className="text-xs text-zinc-500">Multi-factor deterministic scoring comparison</p>
          </div>
        </div>
        <EvidenceBadge classification="calculated" sourceName="Procurement Scoring Engine" onClick={onViewEvidence} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.rankings.map((origin) => {
          const isTop = origin.rank === 1;

          return (
            <div
              key={origin.countryCode}
              className={`p-4 rounded-xl border relative transition ${
                isTop
                  ? 'border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/10'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30'
              }`}
            >
              {isTop && (
                <div className="absolute -top-2.5 right-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Top Recommended
                </div>
              )}

              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h5 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs flex items-center justify-center font-bold">
                      #{origin.rank}
                    </span>
                    {origin.countryName}
                  </h5>
                  <span className="text-[11px] text-zinc-500">
                    Est. Landed: ${origin.landedCostEstimateUSD || 1380}/MT benchmark
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                    {origin.score.total}<span className="text-xs font-normal text-zinc-400">/100</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    Sourcing Score
                  </span>
                </div>
              </div>

              {/* Strengths */}
              <div className="mb-2.5">
                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Key Advantages:
                </div>
                <div className="space-y-1">
                  {origin.strengths.slice(0, 2).map((s, i) => (
                    <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Challenges */}
              {origin.challenges && origin.challenges.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Trade Risks:
                  </div>
                  <div className="space-y-1">
                    {origin.challenges.slice(0, 1).map((c, i) => (
                      <div key={i} className="text-xs text-zinc-500 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {onSelectOrigin && (
                <button
                  type="button"
                  onClick={() => onSelectOrigin(origin.countryName)}
                  className="w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1 transition"
                >
                  <span>Select {origin.countryName} for Sourcing</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
