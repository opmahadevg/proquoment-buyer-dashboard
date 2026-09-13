'use client';

import React from 'react';
import { TrendingUp, Globe2, Package, Layers } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';

interface Props {
  data: {
    product: string;
    hsCode: string;
    destinationCountry: string;
    annualImportVolumeMT: number;
    annualImportValueUSD: number;
    growthRateYoY: number;
    importDependencyPercent: number;
    majorOrigins: { countryName: string; sharePercent: number }[];
    googleSearchGrounding?: {
      query?: string;
      results?: any[];
      corroborationStatus?: string;
      summary?: string;
    };
  };
  onViewEvidence?: () => void;
}

export const MarketOverviewCard: React.FC<Props> = ({ data, onViewEvidence }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Globe2 className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Market Demand: {data.product} → {data.destinationCountry}
            </h4>
          </div>
          <p className="text-xs text-zinc-500 mt-1">HS Code: <strong className="font-mono text-zinc-700 dark:text-zinc-300">{data.hsCode}</strong></p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <EvidenceBadge classification="observed" sourceName="UN Comtrade" onClick={onViewEvidence} />
          {data.googleSearchGrounding && (
            <EvidenceBadge classification="observed" sourceName="Google Search" onClick={onViewEvidence} />
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-zinc-400" />
            Annual Import
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {(data.annualImportVolumeMT || 0).toLocaleString()} <span className="text-xs font-normal text-zinc-500">MT</span>
          </div>
        </div>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="text-[11px] text-zinc-500 font-medium">Trade Value</div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            ${((data.annualImportValueUSD || 0) / 1e6).toFixed(1)} <span className="text-xs font-normal text-zinc-500">M USD</span>
          </div>
        </div>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            YoY Demand
          </div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            +{data.growthRateYoY}%
          </div>
        </div>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            Import Dep.
          </div>
          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {data.importDependencyPercent}%
          </div>
        </div>
      </div>

      {/* Origin Market Share Bars */}
      <div>
        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Origin Supply Distribution
        </div>
        <div className="space-y-2">
          {data.majorOrigins.slice(0, 3).map((origin) => (
            <div key={origin.countryName} className="flex items-center gap-3 text-xs">
              <span className="w-24 text-zinc-600 dark:text-zinc-400 truncate">{origin.countryName}</span>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, origin.sharePercent)}%` }}
                />
              </div>
              <span className="w-10 text-right font-medium text-zinc-800 dark:text-zinc-200">
                {origin.sharePercent}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
