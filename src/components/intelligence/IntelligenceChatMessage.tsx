'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StructuredCard, SuggestedAction, Evidence } from '@/lib/intelligence/core';
import { IntelligenceAttachment } from '@/lib/intelligence/store';
import { FileText, ArrowRight } from 'lucide-react';
import { MarketOverviewCard } from './cards/MarketOverviewCard';
import { PriceIntelligenceCard } from './cards/PriceIntelligenceCard';
import { ComplianceSummaryCard } from './cards/ComplianceSummaryCard';
import { LandedCostCard } from './cards/LandedCostCard';
import { OriginComparisonCard } from './cards/OriginComparisonCard';
import { SupplierLandscapeCard } from './cards/SupplierLandscapeCard';
import { SourcingDecisionCard } from './cards/SourcingDecisionCard';
import { SourcingBriefingCard } from './cards/SourcingBriefingCard';
import { EvidencePanel } from './EvidencePanel';
import { AttachmentAnalysisSummary } from '@/lib/intelligence/core/attachment-analysis';

interface Props {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: IntelligenceAttachment[];
  attachmentAnalysis?: AttachmentAnalysisSummary;
  cards?: StructuredCard[];
  suggestedActions?: SuggestedAction[];
  onActionClick?: (prompt: string) => void;
  onCreateRFQ?: (customBrief?: any) => void;
  onUpdateBriefing?: (cardId: string, updatedData: any) => void;
}

function normalizeMarkdownContent(text: string): string {
  if (!text) return '';
  let normalized = text;

  // 1. Break collapsed table rows where "| |" connects rows
  normalized = normalized.replace(/\|\s*\|\s*([:-]+[-| :]+)/g, '|\n|$1');
  normalized = normalized.replace(/\|\s*\|\s*(?=\d+\s*\|)/g, '|\n| ');
  normalized = normalized.replace(/\|\s*\|\s*(?=[A-Za-z0-9#])/g, '|\n| ');

  // 2. Ensure table delimiter row starts on a new line if glued
  normalized = normalized.replace(/([^\n])\s*(\|[ \t]*[-:]+[-| :]+)/g, '$1\n$2');

  // 3. Ensure blank line before table starts and after table ends
  normalized = normalized.replace(/([^\n])\n(\|[^\n]+\|\n\|[-: |]+\|)/g, '$1\n\n$2');
  normalized = normalized.replace(/(\|[^\n]+\|)\n([^\n|#\-*])/g, '$1\n\n$2');

  // 4. Ensure headings have clean double spacing
  normalized = normalized.replace(/([^\n])\n(#{1,6}\s+[^\n]+)/g, '$1\n\n$2');

  return normalized;
}

export const IntelligenceChatMessage: React.FC<Props> = ({
  role,
  content,
  attachments,
  attachmentAnalysis,
  cards = [],
  suggestedActions = [],
  onActionClick,
  onCreateRFQ,
  onUpdateBriefing,
}) => {
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);

  if (role === 'user') {
    return (
      <div className="flex flex-col items-end mb-6 group">
        {/* Render Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end mb-2 max-w-[80%]">
            {attachments.map((att, idx) => {
              const isImg = att.type.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs"
                >
                  {isImg && att.dataUrl ? (
                    <a
                      href={att.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-11 h-11 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 block shrink-0 hover:opacity-90 transition"
                      title="Open image full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]" title={att.name}>
                      {att.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {att.size ? `${(att.size / 1024).toFixed(0)} KB` : 'Document'} · {isImg ? 'Image' : 'PDF Specs'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* User Message Text */}
        {content && (
          <div className="bg-[#F0F0F2] dark:bg-zinc-800 text-[#0D0D14] dark:text-zinc-100 text-sm px-4 py-2.5 rounded-2xl max-w-[80%] leading-relaxed font-normal">
            {content}
          </div>
        )}
      </div>
    );
  }

  const handleOpenEvidence = (metricTitle?: string) => {
    setSelectedEvidence({
      id: `ev_${Date.now()}`,
      claim: metricTitle || 'Sourcing Intelligence Metric',
      sourceId: 'src_un_comtrade',
      classification: 'observed',
      confidence: 'high',
      methodology: 'Verified institutional customs and bilateral trade database',
      createdAt: new Date().toISOString(),
    });
  };

  // Filter out intake progress cards
  const displayableCards = cards.filter(
    (c) => c.type !== 'intake_status' && c.type !== 'spec_elicitation'
  );

  const briefingCard = displayableCards.find((c) => c.type === 'sourcing_briefing');
  const hasBriefing = Boolean(briefingCard);

  return (
    <div className="mb-8">
      {/* Multimodal Inspection Summary Badge */}
      {attachmentAnalysis && (attachmentAnalysis.observations?.length > 0 || attachmentAnalysis.filesProcessed?.length > 0) && (
        <div className="mb-4 p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between gap-2 font-medium text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Specification Analysis: {attachmentAnalysis.filesProcessed.join(', ')}</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {attachmentAnalysis.extractionMethod}
            </span>
          </div>

          {/* Synthesized Technical Product Description & Brief */}
          {attachmentAnalysis.extractedSpecs?.description && (
            <div className="p-3 rounded-lg bg-white dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/70 shadow-2xs">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                <FileText className="w-3 h-3" />
                <span>Technical Product Description & Brief</span>
              </div>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                {attachmentAnalysis.extractedSpecs.description}
              </p>
            </div>
          )}

          {attachmentAnalysis.observations && attachmentAnalysis.observations.length > 0 && (
            <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 leading-normal">
              {attachmentAnalysis.observations.slice(0, 4).map((obs, idx) => (
                <li key={idx}>{obs}</li>
              ))}
            </ul>
          )}
          {attachmentAnalysis.designAttributes && attachmentAnalysis.designAttributes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {attachmentAnalysis.designAttributes.slice(0, 6).map((attr, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                  {attr}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 1. AI message body — strategic summary and recommendations paragraphs */}
      {content && (
        <div className="text-[15px] text-[#0D0D14] dark:text-zinc-100 leading-[1.7] prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:text-[15px] prose-p:text-[#0D0D14] dark:prose-p:text-zinc-100 prose-strong:font-semibold prose-strong:text-[#0D0D14] dark:prose-strong:text-zinc-100 prose-ul:my-2 prose-ul:space-y-1 prose-li:text-[15px] [&_ul]:pl-5">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ ...props }) => (
                <div className="overflow-x-auto my-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs bg-white dark:bg-zinc-900">
                  <table className="min-w-full divide-y divide-zinc-200/80 dark:divide-zinc-800 text-left text-xs" {...props} />
                </div>
              ),
              thead: ({ ...props }) => (
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold uppercase tracking-wider text-[11px]" {...props} />
              ),
              tbody: ({ ...props }) => (
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900" {...props} />
              ),
              tr: ({ ...props }) => (
                <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors" {...props} />
              ),
              th: ({ ...props }) => (
                <th className="px-3.5 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100 text-[11px]" {...props} />
              ),
              td: ({ ...props }) => (
                <td className="px-3.5 py-2.5 text-zinc-700 dark:text-zinc-300 align-top leading-relaxed text-xs font-normal" {...props} />
              ),
            }}
          >
            {normalizeMarkdownContent(content)}
          </ReactMarkdown>
        </div>
      )}

      {/* 2. Structured Executive Sourcing Briefing Cards (Rendered BELOW the paragraphs) */}
      {displayableCards.length > 0 && (
        <div className="space-y-5 mt-5">
          {displayableCards.map((card) => {
            if (card.type === 'sourcing_briefing') {
              return (
                <SourcingBriefingCard
                  key={card.id}
                  data={card.data as any}
                  onCreateRFQ={onCreateRFQ}
                  onUpdateBriefing={(updated) => onUpdateBriefing?.(card.id, updated)}
                  onViewEvidence={handleOpenEvidence}
                />
              );
            }
            if (card.type === 'market_overview') {
              return <MarketOverviewCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'price_intelligence') {
              return <PriceIntelligenceCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'compliance_summary') {
              return <ComplianceSummaryCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'landed_cost') {
              return <LandedCostCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'origin_comparison') {
              return <OriginComparisonCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'supplier_landscape') {
              return <SupplierLandscapeCard key={card.id} data={card.data as any} onViewEvidence={handleOpenEvidence} />;
            }
            if (card.type === 'sourcing_decision') {
              return (
                <SourcingDecisionCard
                  key={card.id}
                  data={card.data as any}
                  onViewEvidence={handleOpenEvidence}
                  onCreateRFQ={onCreateRFQ}
                />
              );
            }
            return null;
          })}
        </div>
      )}

      {/* 3. Action Chips */}
      {suggestedActions && suggestedActions.length > 0 && !cards.some((c) => c.type === 'sourcing_briefing') && (
        <div className="flex flex-wrap gap-2 mt-4">
          {suggestedActions
            .filter(
              (action) =>
                action.id !== 'act_rfq' &&
                action.id !== 'launch-rfq' &&
                action.id !== 'act_edit_brief' &&
                action.id !== 'act_compare' &&
                action.id !== 'act_landed_scenarios' &&
                action.id !== 'act_suppliers' &&
                !action.label.toLowerCase().includes('launch rfq') &&
                !action.label.toLowerCase().includes('customize briefing') &&
                !action.label.toLowerCase().includes('compare india vs china') &&
                !action.label.toLowerCase().includes('calculate landed cost') &&
                !action.label.toLowerCase().includes('view verified suppliers')
            )
            .sort((a, b) => {
              const aSuggest = a.label.toLowerCase().includes('suggest') || a.id.includes('suggest');
              const bSuggest = b.label.toLowerCase().includes('suggest') || b.id.includes('suggest');
              if (aSuggest && !bSuggest) return -1;
              if (!aSuggest && bSuggest) return 1;
              return 0;
            })
            .map((action) => {
              const isSuggestMe = action.label.toLowerCase().includes('suggest') || action.id.includes('suggest');
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onActionClick?.(action.prompt)}
                  className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                    isSuggestMe
                      ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800'
                      : 'border-gray-300 dark:border-zinc-700 hover:border-[#0D0D14] dark:hover:border-zinc-300 text-[#0D0D14] dark:text-zinc-200 bg-white dark:bg-zinc-900 hover:bg-[#F5F5F8] dark:hover:bg-zinc-800'
                  }`}
                >
                  {isSuggestMe && <span className="text-sm">✨</span>}
                  <span>{action.label}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Evidence Provenance Modal */}
      <EvidencePanel
        evidence={selectedEvidence}
        isOpen={Boolean(selectedEvidence)}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
};
