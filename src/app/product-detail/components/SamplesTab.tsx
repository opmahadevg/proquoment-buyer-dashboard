'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';

export interface SampleItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  supplier: string;
  stage: string;
  requested: string;
  completion: string;
}

export interface ReferenceItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  creator: string;
  stage: string;
  requested: string;
}

interface SamplesTabProps {
  samples: SampleItem[];
  references: ReferenceItem[];
}

const stageBadgeColor = (stage: string) => {
  switch (stage.toLowerCase()) {
    case 'approved':
      return 'bg-green-100 text-green-700';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700';
    case 'in review':
      return 'bg-blue-100 text-blue-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'shipped':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export default function SamplesTab({ samples, references }: SamplesTabProps) {
  const [sampleFilter] = useState('All');

  return (
    <div className="space-y-8">
      {/* Samples Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {samples.length} Samples
        </h2>

        {/* Filter chip */}
        <div className="mb-4">
          <button className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] bg-white hover:bg-[var(--muted)] transition-colors">
            {sampleFilter}
          </button>
        </div>

        {/* Table */}
        <div className="w-full">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-4 pb-2 border-b border-[var(--border)]">
            {['Images', 'Name', 'Type', 'Supplier', 'Stage', 'Requested', 'Completion'].map(
              (col) => (
                <span key={col} className="text-sm text-[var(--muted-foreground)]">
                  {col}
                </span>
              )
            )}
          </div>

          {samples.length === 0 ? (
            <div className="py-16 text-center text-[var(--muted-foreground)] text-sm">
              No samples
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {samples.map((sample) => (
                <div
                  key={sample.id}
                  className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1fr] gap-x-4 py-3 items-center"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
                    <AppImage
                      src={sample.image}
                      alt={sample.imageAlt}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {sample.name}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">{sample.type}</span>
                  <span className="text-sm text-[var(--muted-foreground)]">{sample.supplier}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${stageBadgeColor(sample.stage)}`}
                  >
                    {sample.stage}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">{sample.requested}</span>
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {sample.completion}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* References Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {references.length} References
        </h2>

        {/* Table */}
        <div className="w-full">
          <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-x-4 pb-2 border-b border-[var(--border)]">
            {['Images', 'Name', 'Type', 'Creator', 'Stage', 'Requested'].map((col) => (
              <span key={col} className="text-sm text-[var(--muted-foreground)]">
                {col}
              </span>
            ))}
          </div>

          {references.length === 0 ? (
            <div className="py-16 text-center text-[var(--muted-foreground)] text-sm">
              No references
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-x-4 py-3 items-center"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
                    <AppImage
                      src={ref.image}
                      alt={ref.imageAlt}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {ref.name}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">{ref.type}</span>
                  <span className="text-sm text-[var(--muted-foreground)]">{ref.creator}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${stageBadgeColor(ref.stage)}`}
                  >
                    {ref.stage}
                  </span>
                  <span className="text-sm text-[var(--muted-foreground)]">{ref.requested}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
