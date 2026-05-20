import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  alert?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  href?: string;
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
  href,
}: KpiCardProps) {
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const inner = (
    <div
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5
        active:translate-y-0 active:shadow-md
        ${alert ? 'border-red-300 bg-red-50/30' : 'border-[var(--border)]'}
        ${href ? 'cursor-pointer group' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
        {subValue && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1">{subValue}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        {trendValue && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon size={13} />
            <span>{trendValue}</span>
          </div>
        )}
        {href && (
          <ArrowRight size={13} className="text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}
