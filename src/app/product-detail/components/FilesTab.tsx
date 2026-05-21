'use client';
import React from 'react';
import { FileText, ArrowDownToLine } from 'lucide-react';
import { ProductFile } from '@/lib/productDetailData';

interface FilesTabProps {
  files: ProductFile[];
}

export default function FilesTab({ files }: FilesTabProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">
        {files?.length} File{files?.length !== 1 ? 's' : ''}
      </h3>
      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <span className="text-sm text-[var(--muted-foreground)]">File</span>
        <span className="text-sm text-[var(--muted-foreground)]">Uploaded</span>
      </div>
      {/* File rows */}
      {files?.map((file) => (
        <div
          key={file?.id}
          className="flex items-center justify-between px-4 py-4 border border-[var(--border)] rounded-xl mt-2 hover:bg-[var(--muted)]/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg border border-[var(--border)] flex items-center justify-center flex-shrink-0 bg-white">
              <FileText size={18} className="text-[var(--muted-foreground)]" />
            </div>
            <span className="text-sm text-[var(--foreground)] truncate">{file?.name}</span>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0 ml-4">
            <span className="text-sm text-[var(--muted-foreground)] whitespace-nowrap">
              {file?.date}
            </span>
            <button className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
              <ArrowDownToLine size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
