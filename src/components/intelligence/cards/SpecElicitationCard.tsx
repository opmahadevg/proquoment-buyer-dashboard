'use client';

import React from 'react';
import { CheckCircle2, Circle, ChevronRight, HelpCircle } from 'lucide-react';

interface SpecElicitationCardProps {
  data: {
    currentStage: string;
    currentStageLabel: string;
    progressPercent: number;
    completedStages: string[];
    accumulatedSpecs: Record<string, any>;
    agentRationale?: string;
    suggestedOptions?: Array<{ label: string; value: string; field: string }>;
  };
  onOptionClick?: (value: string) => void;
}

const STAGE_ORDER = ['product', 'quantity', 'destination', 'specifications', 'timeline', 'confirmation'];
const STAGE_LABELS: Record<string, string> = {
  product: 'Product',
  quantity: 'Quantity',
  destination: 'Destination',
  specifications: 'Specifications',
  timeline: 'Timeline',
  confirmation: 'Confirmation',
};

export const SpecElicitationCard: React.FC<SpecElicitationCardProps> = ({ data, onOptionClick }) => {
  const {
    currentStage,
    progressPercent,
    completedStages = [],
    accumulatedSpecs = {},
    agentRationale,
    suggestedOptions = [],
  } = data;

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
            Sourcing Intake Progress
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tabular-nums tracking-tight text-indigo-600 dark:text-indigo-400">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800 w-full">
        <div
          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="p-5">
        {/* Stage Stepper */}
        <div className="flex items-center gap-1 mb-5">
          {STAGE_ORDER.map((stage, idx) => {
            const done = completedStages.includes(stage);
            const active = stage === currentStage;
            return (
              <React.Fragment key={stage}>
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                        ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : active ? (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium truncate max-w-[56px] text-center ${
                      done
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : active
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'text-zinc-400'
                    }`}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {idx < STAGE_ORDER.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mb-4 rounded ${
                      done ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Confirmed Sourcing Parameters (Pills) */}
        {Object.keys(accumulatedSpecs).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {accumulatedSpecs.product && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-2.5">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Product</p>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate mt-0.5">
                  {accumulatedSpecs.product}
                </p>
              </div>
            )}
            {accumulatedSpecs.quantity && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-2.5">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Volume</p>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">
                  {accumulatedSpecs.quantity.toLocaleString()} {accumulatedSpecs.unit || 'units'}
                </p>
              </div>
            )}
            {accumulatedSpecs.destination && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-2.5">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Destination</p>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">
                  {accumulatedSpecs.destination}
                </p>
              </div>
            )}
            {accumulatedSpecs.materialGrade && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-2.5">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Specifications</p>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate mt-0.5">
                  {accumulatedSpecs.materialGrade}
                </p>
              </div>
            )}
            {accumulatedSpecs.certifications?.length > 0 && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 p-2.5">
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Standards</p>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                  {accumulatedSpecs.certifications.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Agent Rationale Tip */}
        {agentRationale && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 mb-4">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-900 dark:text-indigo-300 leading-relaxed">
              {agentRationale}
            </p>
          </div>
        )}

        {/* Contextual Suggestion Chips */}
        {suggestedOptions && suggestedOptions.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Quick Selection:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onOptionClick?.(opt.value)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer text-left"
                >
                  <span>{opt.label}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
