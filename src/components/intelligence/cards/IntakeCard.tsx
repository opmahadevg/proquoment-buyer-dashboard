'use client';

import React from 'react';
import { CheckCircle2, CircleAlert, Package, MapPin, Layers, ArrowRight, Sparkles } from 'lucide-react';

export interface IntakeCardData {
  product: string;
  quantity?: number | string;
  unit?: string;
  destination?: string;
  missingFields: ('quantity' | 'destination' | 'specifications')[];
  suggestedOptions?: Array<{
    label: string;
    value: string;
    field?: string;
  }>;
}

interface Props {
  data: IntakeCardData;
  onSelectOption?: (val: string) => void;
}

export const IntakeCard: React.FC<Props> = ({ data, onSelectOption }) => {
  const { product, quantity, unit, destination, missingFields = [], suggestedOptions = [] } = data;

  const hasQuantity = Boolean(quantity);
  const hasDestination = Boolean(destination);

  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/50 via-white to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100/70 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:white">
              Sourcing Intake & Parameter Setup
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Provide volume and destination to trigger deep trade flows, tariffs, and supplier research.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          Intake in Progress
        </span>
      </div>

      {/* Parameter Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Product Field */}
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Product
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={product}>
            {product || 'Identified'}
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Captured</span>
        </div>

        {/* Quantity Field */}
        <div
          className={`rounded-xl border p-3 ${
            hasQuantity
              ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                hasQuantity ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Target Quantity
            </span>
            {hasQuantity ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CircleAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {hasQuantity ? `${Number(quantity).toLocaleString()} ${unit || 'units'}` : 'Required for research'}
          </p>
          <span
            className={`text-[10px] font-medium ${
              hasQuantity ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {hasQuantity ? 'Captured' : 'Action needed'}
          </span>
        </div>

        {/* Destination Field */}
        <div
          className={`rounded-xl border p-3 ${
            hasDestination
              ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-amber-200/80 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                hasDestination ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Destination
            </span>
            {hasDestination ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CircleAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {destination || 'Required for tariffs/freight'}
          </p>
          <span
            className={`text-[10px] font-medium ${
              hasDestination ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {hasDestination ? 'Captured' : 'Action needed'}
          </span>
        </div>
      </div>

      {/* Suggested Quick Options */}
      {suggestedOptions.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <span>Quick Presets:</span>
            <span className="text-[11px] text-zinc-400 font-normal">Click to autofill and run analysis</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedOptions.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectOption?.(opt.value)}
                className="group px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-zinc-800 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span>{opt.label}</span>
                <ArrowRight className="w-3 h-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
