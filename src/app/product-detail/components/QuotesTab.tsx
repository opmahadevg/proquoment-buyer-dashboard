'use client';
import React from 'react';
import { User, Play, Square, DollarSign } from 'lucide-react';
import { QuoteStep } from '@/lib/productDetailData';

interface QuotesTabProps {
  steps: QuoteStep[];
}

function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2]?.map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </span>
  );
}

function WorldMapBanner() {
  return (
    <div className="mt-8 rounded-xl overflow-hidden bg-[#1a1aff] relative h-40 flex items-center justify-center">
      <svg
        viewBox="0 0 900 200"
        className="absolute inset-0 w-full h-full opacity-60"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {Array.from({ length: 40 })?.map((_, row) =>
          Array.from({ length: 90 })?.map((_, col) => {
            const x = col * 10 + 5;
            const y = row * 5 + 2.5;
            const inMap =
              (col >= 5 && col <= 22 && row >= 4 && row <= 22) ||
              (col >= 10 && col <= 20 && row >= 22 && row <= 36) ||
              (col >= 30 && col <= 42 && row >= 4 && row <= 18) ||
              (col >= 30 && col <= 42 && row >= 18 && row <= 34) ||
              (col >= 42 && col <= 72 && row >= 4 && row <= 26) ||
              (col >= 60 && col <= 72 && row >= 26 && row <= 36);
            if (!inMap) return null;
            return <circle key={`${row}-${col}`} cx={x} cy={y} r={1.5} fill="#6666ff" />;
          })
        )}
      </svg>
    </div>
  );
}

const STEP_ICONS = [User, Play, Square, DollarSign];

export default function QuotesTab({ steps }: QuotesTabProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">Quotes</h3>
      <p className="text-sm text-[var(--muted-foreground)] mb-5">Matching Progress</p>
      <div className="border border-[var(--border)] rounded-xl px-6 py-6">
        <div className="relative">
          {steps?.map((step, idx) => {
            const isActive = step?.status === 'active' || step?.status === 'completed';
            const StepIcon = STEP_ICONS[idx] ?? User;
            return (
              <div key={step?.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <StepIcon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                  </div>
                  {idx < steps?.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 my-1 min-h-[28px] ${
                        isActive ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
                <div className={`pb-6 flex-1 ${idx === steps?.length - 1 ? 'pb-0' : ''}`}>
                  <p
                    className={`text-sm font-semibold mb-0.5 ${isActive ? 'text-[var(--foreground)]' : 'text-gray-400'}`}
                  >
                    {step?.highlight ? (
                      <>
                        {step?.id === 1 ? 'Identified ' : 'Reaching out to '}
                        <span className="text-primary">{step?.highlight}</span>
                        {step?.highlightSuffix}
                        {step?.inProgress && <AnimatedDots />}
                      </>
                    ) : (
                      <>
                        {step?.label}
                        {step?.inProgress && <AnimatedDots />}
                      </>
                    )}
                  </p>
                  <p
                    className={`text-sm ${isActive ? 'text-[var(--muted-foreground)]' : 'text-gray-300'}`}
                  >
                    {step?.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <WorldMapBanner />
    </div>
  );
}
