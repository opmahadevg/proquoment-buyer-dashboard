'use client';

import React from 'react';
import { Calculator, Ship, ShieldCheck, ArrowDownRight } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';

interface Props {
  data: {
    basePriceFOB: number;
    freightEstimateUSD: number;
    containerType: string;
    freightPerMTUSD: number;
    marineInsurancePerMTUSD: number;
    importDutyUSD: number;
    vatTaxUSD: number;
    portHandlingPerMTUSD: number;
    estimatedLandedCostPerMTUSD: number;
    costDeltaPercent: number;
    benchmarkTransitDays: string;
  };
  onViewEvidence?: () => void;
}

export const LandedCostCard: React.FC<Props> = ({ data, onViewEvidence }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
            <Calculator className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Landed Cost Model (Deterministic Audit Trail)
            </h4>
            <p className="text-xs text-zinc-500">
              Port-to-port ocean benchmark ({data.containerType}) · {data.benchmarkTransitDays}
            </p>
          </div>
        </div>
        <EvidenceBadge classification="calculated" sourceName="Deterministic Engine" onClick={onViewEvidence} />
      </div>

      {/* Hero Summary */}
      <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs text-teal-800 dark:text-teal-300 font-medium">
            Estimated Landed Cost Benchmark
          </div>
          <div className="text-2xl font-black text-teal-900 dark:text-teal-100 mt-1">
            ${data.estimatedLandedCostPerMTUSD.toLocaleString()}{' '}
            <span className="text-xs font-normal text-teal-700 dark:text-teal-300">USD/MT</span>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded-full">
            +{data.costDeltaPercent}% over FOB
          </span>
          <div className="text-[11px] text-zinc-500 mt-1">Base FOB: ${data.basePriceFOB}/MT</div>
        </div>
      </div>

      {/* Itemized Waterfall */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400">1. Base FOB Value (Observed Customs)</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">${data.basePriceFOB} /MT</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5 text-zinc-400" />
            2. Estimated Ocean Freight ({data.containerType})
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">+${data.freightPerMTUSD} /MT</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            3. Marine Cargo Insurance (0.3%)
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">+${data.marineInsurancePerMTUSD} /MT</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400">4. Import Customs Duty (0% AIFTA)</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">$0.00 (Exempt)</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-600 dark:text-zinc-400">5. Import VAT / Sales Tax (11%)</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">+${data.vatTaxUSD} /MT</span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-zinc-600 dark:text-zinc-400">6. Port Clearance & Local Handling (THC)</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">+${data.portHandlingPerMTUSD} /MT</span>
        </div>
      </div>
    </div>
  );
};
