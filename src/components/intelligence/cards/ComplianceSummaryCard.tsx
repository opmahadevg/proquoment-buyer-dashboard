'use client';

import React from 'react';
import { ShieldAlert, CheckCircle2, FileCheck, Percent } from 'lucide-react';
import { EvidenceBadge } from '../EvidenceBadge';

interface Props {
  data: {
    destinationCountry: string;
    effectiveTariffRate: string;
    mfnRate: string;
    requiredCertifications: string[];
    standardsAgencies?: string[];
    mandatoryInspection?: boolean;
  };
  onViewEvidence?: () => void;
}

export const ComplianceSummaryCard: React.FC<Props> = ({ data, onViewEvidence }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
            <FileCheck className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Compliance & Tariff Prerequisites: {data.destinationCountry}
            </h4>
            <p className="text-xs text-zinc-500">WTO ePing notifications & official customs schedules</p>
          </div>
        </div>
        <EvidenceBadge classification="observed" sourceName="WTO & WITS" onClick={onViewEvidence} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Tariff Duty */}
        <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl">
          <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            <span className="flex items-center gap-1">
              <Percent className="w-3.5 h-3.5" />
              Applied Import Duty
            </span>
            <span className="text-[11px] opacity-75">MFN: {data.mfnRate}</span>
          </div>
          <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1">
            {data.effectiveTariffRate}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
            Preferential zero-duty status under bilateral trade agreement
          </div>
        </div>

        {/* Inspection Requirement */}
        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 rounded-xl">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Inspection Protocol
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {data.mandatoryInspection ? 'Pre-Shipment & Customs Inspection' : 'Standard Document Clearance'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Authorized by {data.standardsAgencies?.join(', ') || 'Customs Authority'}
          </div>
        </div>
      </div>

      {/* Mandatory Certifications */}
      <div>
        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
          Mandatory Clearance Documents & Certifications:
        </div>
        <div className="space-y-1.5">
          {data.requiredCertifications.map((cert) => (
            <div
              key={cert}
              className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-medium">{cert}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
