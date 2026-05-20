import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  alert?: boolean;
  icon: React.ReactNode;
  iconBg: string;
}

export default function KpiCard({
  label,
  value,
  subValue,
  trend,
  trendValue,
  alert,
  icon,
  iconBg,
}: KpiCardProps) {
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${
        alert ? 'border-red-300 bg-red-50/30' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
        {subValue && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">{subValue}</p>
        )}
      </div>
      {trendValue && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon size={13} />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}