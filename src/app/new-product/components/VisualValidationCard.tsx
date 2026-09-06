import React, { useState } from 'react';
import { Check, Edit3, ArrowRight, Loader2, Maximize2, X, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';

export interface VisualCardSpecItem {
  label: string;
  value: string;
}

export interface VisualCardData {
  id: string;
  version: number;
  status: 'generating' | 'ready' | 'confirmed' | 'failed' | 'bypassed';
  imageUrl?: string;
  specs: VisualCardSpecItem[];
  promptUsed?: string;
  modelUsed?: string;
  errorMessage?: string;
  generationCount?: number;
  maxGenerations?: number;
}

export interface VisualValidationCardProps {
  card: VisualCardData;
  onLooksRight: () => void;
  onChangeSomething: () => void;
  onProceedWithoutImage: () => void;
  isProcessing?: boolean;
}

export function VisualValidationCard({
  card,
  onLooksRight,
  onChangeSomething,
  onProceedWithoutImage,
  isProcessing = false,
}: VisualValidationCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isGenerating = card.status === 'generating';
  const isConfirmed = card.status === 'confirmed';
  const isFailed = card.status === 'failed';

  return (
    <>
      <div className="w-full max-w-[500px] bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] p-4 my-3 relative overflow-hidden transition-all duration-200">
        {/* Subtle decorative top hairline accent */}
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-transparent via-[#3B35E8]/60 to-transparent" />

        {/* Header Bar */}
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center flex-shrink-0 text-[#3B35E8]">
              <Sparkles size={13} />
            </div>
            <div>
              <h4 className="text-[13.5px] font-semibold text-[#0D0D14] tracking-tight leading-none">
                AI Requirement Interpretation
              </h4>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5 leading-none">
                Visual synthesis for specification review
              </p>
            </div>
          </div>
          {card.generationCount !== undefined && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-500"
              title={`Visual generation ${card.generationCount} of maximum ${card.maxGenerations || 4}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B35E8] animate-pulse" />
              <span className="font-mono text-[10.5px]">
                Preview {card.generationCount}/{card.maxGenerations || 4}
              </span>
            </div>
          )}
        </div>

        {/* Content Body: Image Showcase on left, Spec Table on right */}
        <div className="grid grid-cols-[160px_1fr] gap-3.5 mb-3.5 items-stretch">
          {/* Left: Product Studio Showcase */}
          <div className="relative w-[160px] min-h-[160px] rounded-xl overflow-hidden bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-100 border border-slate-200/80 flex items-center justify-center flex-shrink-0 group shadow-inner">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center gap-2 p-3 text-center">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-indigo-100 animate-ping opacity-75" />
                  <Loader2 size={22} className="animate-spin text-[#3B35E8] relative z-10" />
                </div>
                <span className="text-[11px] text-slate-500 font-medium leading-tight mt-1">
                  Synthesizing visual preview…
                </span>
              </div>
            ) : isFailed || !card.imageUrl ? (
              <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center text-slate-400">
                <AlertCircle size={22} className="text-amber-500/80" />
                <span className="text-[11px] font-medium leading-tight">
                  Visual preview unavailable
                </span>
                <span className="text-[10px] text-slate-400">
                  Using written specs
                </span>
              </div>
            ) : (
              <>
                <img
                  src={card.imageUrl}
                  alt="AI Product Interpretation"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/images/no_image.png';
                  }}
                />
                {/* Micro Concept Chip */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-medium text-white tracking-wider uppercase shadow-xs">
                  Concept
                </div>
                {/* Expand Pill on hover */}
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  title="Expand image"
                >
                  <Maximize2 size={11} />
                  <span>Zoom</span>
                </button>
              </>
            )}
          </div>

          {/* Right: Technical Spec Plate */}
          <div className="flex flex-col justify-between bg-slate-50/70 border border-slate-200/70 rounded-xl p-2.5 min-w-0 shadow-2xs">
            <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-200/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Captured Specs
              </span>
              <span className="text-[9.5px] text-slate-400 font-mono">
                B2B Sourcing
              </span>
            </div>

            <div className="space-y-1 text-[11.5px] flex-1 flex flex-col justify-around">
              {card.specs.map((item, index) => (
                <div key={index} className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-400 font-normal text-[11px] truncate flex-shrink-0">
                    {item.label}
                  </span>
                  <span
                    className="text-slate-800 font-semibold text-[11.5px] truncate text-right max-w-[170px]"
                    title={item.value}
                  >
                    {item.value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isConfirmed ? (
          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-xl py-2.5 px-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 text-emerald-800 text-xs font-semibold">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Check size={12} className="stroke-[3]" />
              </div>
              <div>
                <p className="leading-tight font-semibold">Visual Approved by Buyer</p>
                <p className="text-[10px] font-normal text-emerald-600">Locked for supplier matching</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onChangeSomething}
              disabled={isProcessing}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs"
            >
              Modify
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Top row: Looks right & Change something */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onLooksRight}
                disabled={isGenerating || isProcessing}
                className="bg-[#3B35E8] hover:bg-[#312BC7] active:scale-[0.99] text-white text-[12px] font-semibold py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-[0_2px_8px_rgba(59,53,232,0.24)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Looks right</span>
              </button>

              <button
                type="button"
                onClick={onChangeSomething}
                disabled={isProcessing}
                className="bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200/90 text-slate-700 hover:text-slate-900 text-[12px] font-medium py-2.5 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit3 size={13} className="text-slate-500" />
                <span>Change something</span>
              </button>
            </div>

            {/* Bottom row: Proceed without image */}
            <button
              type="button"
              onClick={onProceedWithoutImage}
              disabled={isProcessing}
              className="w-full text-slate-400 hover:text-slate-600 text-[11px] font-medium py-1 flex items-center justify-center gap-1 transition-colors group"
            >
              <span>Proceed without visual confirmation</span>
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        {/* Subtle Disclaimer */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center mt-2.5 pt-2 border-t border-slate-100">
          <ShieldCheck size={11} className="text-slate-300" />
          <span>Illustrative studio concept · Finalized specifications guide supplier production</span>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && card.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-xl w-full bg-slate-900/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white z-10 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
              <img
                src={card.imageUrl}
                alt="High resolution product preview"
                className="w-full h-auto object-contain max-h-[75vh]"
              />
            </div>
            <div className="pt-3 pb-1 px-1">
              <div className="flex items-center justify-between text-xs text-white/80 mb-2 font-medium">
                <span>Product Visualization Spec</span>
                <span className="text-white/40 font-mono text-[11px]">
                  Preview {card.generationCount || 1}/{card.maxGenerations || 4}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {card.specs.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[11px]"
                  >
                    <span className="text-white/40 mr-1">{s.label}:</span> {s.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
