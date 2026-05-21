import React from 'react';

type Stage = 'Quoting' | 'Draft' | 'Ordered' | 'Archived' | 'Reviewing';

interface StageBadgeProps {
  stage: string;
}

const stageConfig: Record<Stage, { bg: string; text: string; dot: string; label: string }> = {
  Quoting: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Quoting' },
  Draft: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Draft' },
  Ordered: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Ordered' },
  Archived: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Archived' },
  Reviewing: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Reviewing' },
};

export default function StageBadge({ stage }: StageBadgeProps) {
  const cfg = stageConfig[stage as Stage] ?? stageConfig['Draft'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
