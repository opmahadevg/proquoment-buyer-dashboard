'use client';

import React from 'react';
import { EvidenceClassification } from '@/lib/intelligence/core';

interface Props {
  classification: EvidenceClassification | 'unknown' | string;
  sourceName?: string;
  onClick?: () => void;
  className?: string;
}

export const EvidenceBadge: React.FC<Props> = ({
  classification,
  sourceName,
  onClick,
  className = '',
}) => {
  const norm = String(classification).toLowerCase();

  let label = 'Observed';
  let badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

  if (norm === 'calculated') {
    label = 'Calculated';
    badgeStyle = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  } else if (norm === 'ai-inference' || norm === 'ai assessment' || norm === 'ai_suggested') {
    label = 'AI Assessment';
    badgeStyle = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
  } else if (norm === 'unknown') {
    label = 'Unknown / Unverified';
    badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={sourceName ? `Source: ${sourceName}` : undefined}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${badgeStyle} ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{label}</span>
      {sourceName && (
        <span className="text-[10px] opacity-75 font-normal border-l pl-1 border-current">
          {sourceName}
        </span>
      )}
    </button>
  );
};
