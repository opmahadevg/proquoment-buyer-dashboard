'use client';
import React from 'react';

// Root loading.tsx — shown by Next.js App Router during route segment transitions.
// Renders inside AppLayout's <main> slot so sidebar stays visible.
export default function Loading() {
  return (
    <div className="px-8 py-6 max-w-screen-2xl mx-auto animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-48 bg-[var(--muted)] rounded-lg shimmer" />
        <div className="h-8 w-28 bg-[var(--muted)] rounded-lg shimmer" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-[var(--border)] rounded-xl p-5 space-y-3"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-[var(--muted)] rounded shimmer" />
              <div className="w-9 h-9 rounded-lg bg-[var(--muted)] shimmer" />
            </div>
            <div className="h-7 w-20 bg-[var(--muted)] rounded shimmer" />
            <div className="h-3 w-32 bg-[var(--muted)] rounded shimmer" />
          </div>
        ))}
      </div>

      {/* Chart row skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-white border border-[var(--border)] rounded-xl p-6"
          >
            <div className="h-5 w-40 bg-[var(--muted)] rounded shimmer mb-4" />
            <div className="h-[200px] bg-[var(--muted)] rounded-lg shimmer" />
          </div>
        ))}
      </div>

      {/* Activity feed skeleton */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-6 space-y-4">
        <div className="h-5 w-32 bg-[var(--muted)] rounded shimmer" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--muted)] shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 bg-[var(--muted)] rounded shimmer" />
              <div className="h-3 w-1/3 bg-[var(--muted)] rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
