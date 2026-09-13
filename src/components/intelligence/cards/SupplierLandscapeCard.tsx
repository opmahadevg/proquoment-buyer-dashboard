'use client';

import React from 'react';
import { Users, CheckCircle, BadgeCheck, ExternalLink } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';
import { SupplierProfile } from '@/lib/intelligence/core';

interface Props {
  data: {
    verifiedSuppliers: SupplierProfile[];
    totalIdentified: number;
    primaryClusters: string[];
  };
  onViewEvidence?: () => void;
}

export const SupplierLandscapeCard: React.FC<Props> = ({ data, onViewEvidence }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <Users className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Verified Supplier Ecosystem ({data.totalIdentified} Qualified Partners)
            </h4>
            <p className="text-xs text-zinc-500">Proquoment vetted manufacturer network</p>
          </div>
        </div>
        <EvidenceBadge classification="observed" sourceName="Proquoment DB" onClick={onViewEvidence} />
      </div>

      {/* Manufacturing Clusters */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="text-xs text-zinc-500 mr-1 flex items-center">Key Hubs:</span>
        {data.primaryClusters.map((cluster) => (
          <span
            key={cluster}
            className="px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
          >
            {cluster}
          </span>
        ))}
      </div>

      {/* Supplier List */}
      <div className="space-y-3">
        {data.verifiedSuppliers.slice(0, 3).map((sup) => (
          <div
            key={sup.id}
            className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{sup.name}</span>
                {sup.verified && (
                  <span title="Proquoment Verified">
                    <BadgeCheck className="w-4 h-4 text-emerald-500 inline shrink-0" />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Origin: <strong className="text-zinc-700 dark:text-zinc-300">{sup.country}</strong> · Monthly Capacity:{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">{sup.productionCapacity || '500+ MT'}</strong>
              </div>
              {sup.certifications && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {sup.certifications.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Score: {sup.reliabilityScore || 95}% Reliability
              </div>
              <span className="text-[10px] text-zinc-400">Direct Factory Allocation</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
