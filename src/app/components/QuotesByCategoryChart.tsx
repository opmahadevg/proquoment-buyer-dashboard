'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORY_DATA: Record<string, { category: string; received: number; accepted: number }[]> = {
  'range-7d': [
    { category: 'Apparel', received: 3, accepted: 2 },
    { category: 'Electronics', received: 2, accepted: 1 },
    { category: 'Home Goods', received: 2, accepted: 2 },
    { category: 'Packaging', received: 1, accepted: 1 },
  ],
  'range-30d': [
    { category: 'Apparel', received: 8, accepted: 5 },
    { category: 'Textiles', received: 6, accepted: 4 },
    { category: 'Electronics', received: 4, accepted: 2 },
    { category: 'Home Goods', received: 5, accepted: 3 },
    { category: 'Packaging', received: 3, accepted: 2 },
  ],
  'range-monthly': [
    { category: 'Apparel', received: 8, accepted: 5 },
    { category: 'Textiles', received: 6, accepted: 4 },
    { category: 'Electronics', received: 4, accepted: 2 },
    { category: 'Home Goods', received: 5, accepted: 3 },
    { category: 'Packaging', received: 3, accepted: 2 },
    { category: 'Food', received: 2, accepted: 2 },
  ],
  'range-custom': [
    { category: 'Apparel', received: 14, accepted: 9 },
    { category: 'Textiles', received: 11, accepted: 7 },
    { category: 'Electronics', received: 6, accepted: 3 },
    { category: 'Home Goods', received: 8, accepted: 5 },
    { category: 'Packaging', received: 4, accepted: 2 },
    { category: 'Food', received: 3, accepted: 3 },
  ],
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-lg shadow-lg px-4 py-3">
        <p className="text-xs font-semibold text-[var(--foreground)] mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={`tooltip-item-${i}`} className="text-xs text-[var(--muted-foreground)]">
            <span className="font-medium" style={{ color: p.color }}>
              {p.name}:{' '}
            </span>
            {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface QuotesByCategoryChartProps {
  range?: string;
}

export default function QuotesByCategoryChart({ range = 'range-30d' }: QuotesByCategoryChartProps) {
  const data = CATEGORY_DATA[range] || CATEGORY_DATA['range-30d'];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7f0" vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="received" name="Received" fill="#c7c5f8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="accepted" name="Accepted" fill="#3B35E8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
