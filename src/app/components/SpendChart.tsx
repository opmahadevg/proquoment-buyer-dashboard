'use client';
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CHART_DATA: Record<string, { label: string; key: string; data: { month: string; spend: number }[] }> = {
  'range-7d': {
    label: '26 Apr – 2 May 2026',
    key: 'day',
    data: [
      { month: 'Sun', spend: 400 },
      { month: 'Mon', spend: 2800 },
      { month: 'Tue', spend: 3200 },
      { month: 'Wed', spend: 1900 },
      { month: 'Thu', spend: 2600 },
      { month: 'Fri', spend: 1100 },
      { month: 'Sat', spend: 300 },
    ],
  },
  'range-30d': {
    label: 'Apr 2026',
    key: 'week',
    data: [
      { month: 'Wk 1', spend: 8200 },
      { month: 'Wk 2', spend: 11400 },
      { month: 'Wk 3', spend: 9600 },
      { month: 'Wk 4', spend: 9750 },
    ],
  },
  'range-monthly': {
    label: 'Nov 2025 – Apr 2026',
    key: 'month',
    data: [
      { month: 'Nov', spend: 18400 },
      { month: 'Dec', spend: 24100 },
      { month: 'Jan', spend: 19800 },
      { month: 'Feb', spend: 31200 },
      { month: 'Mar', spend: 27600 },
      { month: 'Apr', spend: 38950 },
    ],
  },
  'range-custom': {
    label: 'Nov 2025 – May 2026',
    key: 'month',
    data: [
      { month: 'Nov', spend: 18400 },
      { month: 'Dec', spend: 24100 },
      { month: 'Jan', spend: 19800 },
      { month: 'Feb', spend: 31200 },
      { month: 'Mar', spend: 27600 },
      { month: 'Apr', spend: 38950 },
      { month: 'May', spend: 12300 },
    ],
  },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg px-4 py-3">
        <p className="text-xs text-[var(--muted-foreground)] mb-1">{label}</p>
        <p className="text-sm font-bold text-[var(--foreground)]">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

interface SpendChartProps {
  range?: string;
  customLabel?: string;
}

export default function SpendChart({ range = 'range-30d', customLabel }: SpendChartProps) {
  const config = CHART_DATA[range] || CHART_DATA['range-30d'];
  const data = config.data;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B35E8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3B35E8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="spend"
          stroke="#3B35E8"
          strokeWidth={2.5}
          fill="url(#spendGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { CHART_DATA };
