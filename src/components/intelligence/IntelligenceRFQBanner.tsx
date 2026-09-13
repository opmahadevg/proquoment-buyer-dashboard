'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  workspaceId?: string;
  productName?: string;
  score?: number;
  origin?: string;
  destination?: string;
  onDismiss?: () => void;
}

export const IntelligenceRFQBanner: React.FC<Props> = ({
  workspaceId,
  productName = 'Product',
  score = 87,
  origin = 'India',
  destination = 'Indonesia',
  onDismiss,
}) => {
  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-4 shadow-lg border border-indigo-500/30 mb-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs text-white shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Intelligence-Assisted RFQ Pre-fill
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Sourcing Score: {score}/100
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mt-0.5">
              Verified Sourcing Corridor: {origin} → {destination} ({productName})
            </h4>
            <p className="text-xs text-indigo-200/90 mt-1">
              Pre-filled with verified trade flows, 0% FTA preferential tariff classification, and manufacturer accreditations. Target price left blank for your strategic negotiation entry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:self-center">
          {workspaceId && (
            <Link
              href={`/intelligence/workspace/${workspaceId}`}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition backdrop-blur-xs"
            >
              <span>View Full Research</span>
              <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
            </Link>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-indigo-300 hover:text-white p-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
