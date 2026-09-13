'use client';

import React from 'react';
import { X, ExternalLink, ShieldCheck, Database, Calendar } from 'lucide-react';
import { Evidence } from '@/lib/intelligence/core';
import { KNOWN_SOURCES } from '@/lib/intelligence/evidence/source-registry';
import { EvidenceBadge } from './EvidenceBadge';

interface Props {
  evidence: Evidence | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidencePanel: React.FC<Props> = ({ evidence, isOpen, onClose }) => {
  if (!isOpen || !evidence) return null;

  const sourceKey = evidence.sourceId.replace('src_', '');
  const source = KNOWN_SOURCES[sourceKey] || {
    name: evidence.sourceId,
    publisher: undefined,
    type: 'official',
    url: undefined,
    dataPeriod: 'Official customs / institutional statistics',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Evidence Provenance & Verification
          </h3>
        </div>

        <div className="space-y-4">
          {/* Claim */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Verified Claim
            </div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {evidence.claim}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <EvidenceBadge classification={evidence.classification} />
              <span className="text-xs text-zinc-500">
                Confidence: <strong className="capitalize">{evidence.confidence}</strong>
              </span>
            </div>
          </div>

          {/* Source Details */}
          <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-start gap-2">
              <Database className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">Primary Source: </span>
                {source.name} {source.publisher && `(${source.publisher})`}
              </div>
            </div>

            {source.dataPeriod && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Data Window: </span>
                  {source.dataPeriod}
                </div>
              </div>
            )}

            {evidence.methodology && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 rounded-lg border border-blue-200/50 dark:border-blue-900/50">
                <span className="font-semibold block mb-0.5">Calculation & Extraction Methodology:</span>
                {evidence.methodology}
              </div>
            )}
          </div>

          {/* Source Link */}
          {source.url && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                <span>Inspect Authoritative Registry</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
