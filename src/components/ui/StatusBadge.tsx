import React from 'react';

type Status = 'New Update' | 'Action Required' | 'No Updates' | 'Resolved';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { border: string; text: string; bg: string }> = {
  'New Update': {
    border: 'border-[var(--accent)]',
    text: 'text-[var(--accent)]',
    bg: 'bg-transparent',
  },
  'Action Required': {
    border: 'border-red-400',
    text: 'text-red-500',
    bg: 'bg-transparent',
  },
  'No Updates': {
    border: 'border-gray-300',
    text: 'text-gray-400',
    bg: 'bg-transparent',
  },
  Resolved: {
    border: 'border-green-400',
    text: 'text-green-600',
    bg: 'bg-transparent',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? statusConfig['No Updates'];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${cfg.border} ${cfg.text} ${cfg.bg}`}
    >
      {status}
    </span>
  );
}
