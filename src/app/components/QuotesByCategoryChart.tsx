'use client';
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchBuyerRFQs, fetchBuyerQuotes } from '@/lib/services/procurementApi';
import { Loader2, FileText } from 'lucide-react';

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

const mapProductToCategory = (productName: string): string => {
  const name = (productName || '').toLowerCase();
  if (
    name.includes('apparel') ||
    name.includes('clothing') ||
    name.includes('shirt') ||
    name.includes('t-shirt') ||
    name.includes('garment') ||
    name.includes('hoodie') ||
    name.includes('pant') ||
    name.includes('sock') ||
    name.includes('wear')
  )
    return 'Apparel';
  if (
    name.includes('textile') ||
    name.includes('fabric') ||
    name.includes('yarn') ||
    name.includes('cotton') ||
    name.includes('silk') ||
    name.includes('wool') ||
    name.includes('polyester')
  )
    return 'Textiles';
  if (
    name.includes('electronic') ||
    name.includes('phone') ||
    name.includes('cable') ||
    name.includes('charger') ||
    name.includes('led') ||
    name.includes('device') ||
    name.includes('sensor') ||
    name.includes('computer')
  )
    return 'Electronics';
  if (
    name.includes('home') ||
    name.includes('furniture') ||
    name.includes('kitchen') ||
    name.includes('decor') ||
    name.includes('bedding') ||
    name.includes('towel') ||
    name.includes('sheet') ||
    name.includes('rug')
  )
    return 'Home Goods';
  if (
    name.includes('package') ||
    name.includes('box') ||
    name.includes('bag') ||
    name.includes('carton') ||
    name.includes('pouch') ||
    name.includes('bottle') ||
    name.includes('sleeve') ||
    name.includes('wrapper')
  )
    return 'Packaging';
  if (
    name.includes('food') ||
    name.includes('snack') ||
    name.includes('beverage') ||
    name.includes('drink') ||
    name.includes('ingredient') ||
    name.includes('coffee') ||
    name.includes('tea')
  )
    return 'Food';
  return 'Industrial';
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
  isDemo?: boolean;
}

export default function QuotesByCategoryChart({
  range = 'range-30d',
  isDemo = false,
}: QuotesByCategoryChartProps) {
  const [data, setData] = useState<{ category: string; received: number; accepted: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setData(CATEGORY_DATA[range] || CATEGORY_DATA['range-30d']);
      setHasData(true);
      setLoading(false);
      return;
    }

    const loadRealQuotes = async () => {
      setLoading(true);
      try {
        const [rfqs, quotes] = await Promise.all([fetchBuyerRFQs(), fetchBuyerQuotes()]);

        if (!quotes || quotes.length === 0) {
          const fallbackPlaceholder = [
            { category: 'Apparel', received: 0, accepted: 0 },
            { category: 'Textiles', received: 0, accepted: 0 },
            { category: 'Electronics', received: 0, accepted: 0 },
            { category: 'Packaging', received: 0, accepted: 0 },
          ];
          setData(fallbackPlaceholder);
          setHasData(false);
          return;
        }

        const rfqMap = new Map<string, any>();
        rfqs.forEach((r) => rfqMap.set(r.id, r));

        const categoryCounts: Record<string, { received: number; accepted: number }> = {};

        // Pre-populate actual categories from RFQs
        rfqs.forEach((rfq) => {
          const cat = mapProductToCategory(rfq.product);
          if (!categoryCounts[cat]) {
            categoryCounts[cat] = { received: 0, accepted: 0 };
          }
        });

        // Group quotes into categories
        quotes.forEach((q) => {
          const rfq = rfqMap.get(q.rfqId);
          const cat = rfq ? mapProductToCategory(rfq.product) : 'Industrial';
          if (!categoryCounts[cat]) {
            categoryCounts[cat] = { received: 0, accepted: 0 };
          }
          categoryCounts[cat].received += 1;
          if (q.status === 'accepted') {
            categoryCounts[cat].accepted += 1;
          }
        });

        const formatted = Object.entries(categoryCounts).map(([cat, counts]) => ({
          category: cat,
          received: counts.received,
          accepted: counts.accepted,
        }));

        // Sort by received descending
        formatted.sort((a, b) => b.received - a.received);

        if (formatted.length === 0 || !formatted.some((f) => f.received > 0)) {
          const fallbackPlaceholder = [
            { category: 'Apparel', received: 0, accepted: 0 },
            { category: 'Textiles', received: 0, accepted: 0 },
            { category: 'Electronics', received: 0, accepted: 0 },
            { category: 'Packaging', received: 0, accepted: 0 },
          ];
          setData(fallbackPlaceholder);
          setHasData(false);
        } else {
          setData(formatted);
          setHasData(true);
        }
      } catch (err) {
        console.error('Failed to load real quotes data:', err);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    loadRealQuotes();
  }, [range, isDemo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] gap-2">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="text-xs text-[var(--muted-foreground)]">Analyzing quotes...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7f0" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          {hasData && <Tooltip content={<CustomTooltip />} />}
          <Bar dataKey="received" name="Received" fill="#c7c5f8" radius={[3, 3, 0, 0]} />
          <Bar dataKey="accepted" name="Accepted" fill="#3B35E8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {!hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl transition-all duration-300">
          <div className="p-3 bg-indigo-50 rounded-full text-primary mb-2 shadow-sm animate-pulse">
            <FileText size={20} />
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">No quotes received yet</p>
          <p className="text-xs text-[var(--muted-foreground)] text-center max-w-[240px] mt-1 px-4">
            Quotes from verified manufacturers will appear here categorized by product.
          </p>
        </div>
      )}
    </div>
  );
}
