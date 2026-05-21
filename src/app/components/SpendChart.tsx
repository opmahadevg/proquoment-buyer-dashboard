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

const CHART_DATA: Record<
  string,
  { label: string; key: string; data: { month: string; spend: number }[] }
> = {
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

import { useState, useEffect } from 'react';
import { fetchBuyerOrders } from '@/lib/services/procurementApi';
import { Loader2, TrendingUp } from 'lucide-react';

interface SpendChartProps {
  range?: string;
  customLabel?: string;
  isDemo?: boolean;
}

export default function SpendChart({
  range = 'range-30d',
  customLabel,
  isDemo = false,
}: SpendChartProps) {
  const [data, setData] = useState<{ month: string; spend: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    if (isDemo) {
      const config = CHART_DATA[range] || CHART_DATA['range-30d'];
      setData(config.data);
      setHasData(true);
      setLoading(false);
      return;
    }

    const loadRealSpend = async () => {
      setLoading(true);
      try {
        const orders = await fetchBuyerOrders();

        if (!orders || orders.length === 0) {
          const fallbackPlaceholder = [
            { month: 'Wk 1', spend: 0 },
            { month: 'Wk 2', spend: 0 },
            { month: 'Wk 3', spend: 0 },
            { month: 'Wk 4', spend: 0 },
          ];
          setData(fallbackPlaceholder);
          setHasData(false);
          return;
        }

        if (range === 'range-7d') {
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
              dateStr: d.toLocaleDateString(),
              dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
              spend: 0,
            };
          });

          orders.forEach((o) => {
            if (!o.createdAt) return;
            const oDate = new Date(o.createdAt).toLocaleDateString();
            const val = parseFloat(String(o.value || '0').replace(/[^0-9.]/g, '')) || 0;
            const match = last7.find((item) => item.dateStr === oDate);
            if (match) {
              match.spend += val;
            }
          });

          const formatted = last7.map((item) => ({ month: item.dayName, spend: item.spend }));
          setData(formatted);
          setHasData(formatted.some((f) => f.spend > 0));
        } else if (range === 'range-30d') {
          const now = new Date();
          const weeks = [
            {
              label: 'Wk 1',
              start: new Date(now.getTime() - 30 * 24 * 3600 * 1000),
              end: new Date(now.getTime() - 22.5 * 24 * 3600 * 1000),
              spend: 0,
            },
            {
              label: 'Wk 2',
              start: new Date(now.getTime() - 22.5 * 24 * 3600 * 1000),
              end: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
              spend: 0,
            },
            {
              label: 'Wk 3',
              start: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
              end: new Date(now.getTime() - 7.5 * 24 * 3600 * 1000),
              spend: 0,
            },
            {
              label: 'Wk 4',
              start: new Date(now.getTime() - 7.5 * 24 * 3600 * 1000),
              end: now,
              spend: 0,
            },
          ];

          orders.forEach((o) => {
            if (!o.createdAt) return;
            const oTime = new Date(o.createdAt).getTime();
            const val = parseFloat(String(o.value || '0').replace(/[^0-9.]/g, '')) || 0;
            for (const w of weeks) {
              if (oTime >= w.start.getTime() && oTime <= w.end.getTime()) {
                w.spend += val;
                break;
              }
            }
          });

          const formatted = weeks.map((w) => ({ month: w.label, spend: w.spend }));
          setData(formatted);
          setHasData(formatted.some((f) => f.spend > 0));
        } else {
          // range-monthly or range-custom (display last 6 months)
          const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return {
              monthKey: `${d.getFullYear()}-${d.getMonth()}`,
              monthName: d.toLocaleDateString('en-US', { month: 'short' }),
              spend: 0,
            };
          });

          orders.forEach((o) => {
            if (!o.createdAt) return;
            const d = new Date(o.createdAt);
            const mKey = `${d.getFullYear()}-${d.getMonth()}`;
            const val = parseFloat(String(o.value || '0').replace(/[^0-9.]/g, '')) || 0;
            const match = months.find((item) => item.monthKey === mKey);
            if (match) {
              match.spend += val;
            }
          });

          const formatted = months.map((m) => ({ month: m.monthName, spend: m.spend }));
          setData(formatted);
          setHasData(formatted.some((f) => f.spend > 0));
        }
      } catch (err) {
        console.error('Failed to load real spend data:', err);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    loadRealSpend();
  }, [range, isDemo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] gap-2">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="text-xs text-[var(--muted-foreground)]">Analyzing spend...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
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
            tickFormatter={(v) => (v === 0 ? '$0' : `$${(v / 1000).toFixed(0)}k`)}
          />
          {hasData && <Tooltip content={<CustomTooltip />} />}
          <Area
            type="monotone"
            dataKey="spend"
            stroke="#3B35E8"
            strokeWidth={2.5}
            fill="url(#spendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl transition-all duration-300">
          <div className="p-3 bg-blue-50 rounded-full text-primary mb-2 shadow-sm animate-pulse">
            <TrendingUp size={20} />
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">No spend recorded yet</p>
          <p className="text-xs text-[var(--muted-foreground)] text-center max-w-[240px] mt-1 px-4">
            Your orders' total contract value will populate this chart dynamically.
          </p>
        </div>
      )}
    </div>
  );
}

export { CHART_DATA };
