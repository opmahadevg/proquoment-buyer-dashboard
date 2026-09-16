'use client';
import React from 'react';
import { FileText, ArrowDownToLine, Image as ImageIcon, Sparkles, ExternalLink } from 'lucide-react';

export interface UnifiedProductFile {
  id: string;
  name: string;
  date: string;
  url?: string;
  fileType?: string;
  sourceContext?: string;
}

interface FilesTabProps {
  files: UnifiedProductFile[];
}

export default function FilesTab({ files }: FilesTabProps) {
  const isImage = (fileName: string, fileType?: string) => {
    return (
      fileType === 'ai_generated_concept' ||
      fileType === 'reference_image' ||
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName)
    );
  };

  const getBadge = (fileType?: string) => {
    switch (fileType) {
      case 'ai_generated_concept':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles size={11} />
            AI Concept
          </span>
        );
      case 'buyer_upload':
      case 'reference_image':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <ImageIcon size={11} />
            Reference
          </span>
        );
      case 'tech_pack':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Tech Pack
          </span>
        );
      case 'rfq_document':
      case 'spec_sheet':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            RFQ Spec
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--foreground)]">
          {files?.length || 0} File{files?.length !== 1 ? 's' : ''}
        </h3>
      </div>

      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <span className="text-sm text-[var(--muted-foreground)]">File & Classification</span>
        <span className="text-sm text-[var(--muted-foreground)]">Uploaded</span>
      </div>

      {(!files || files.length === 0) ? (
        <div className="text-center py-12 px-4 border border-dashed border-[var(--border)] rounded-xl mt-3">
          <FileText className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--muted-foreground)]">No files attached to this product yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Uploaded images and generated AI concept designs will automatically sync here.</p>
        </div>
      ) : (
        files.map((file) => {
          const isImg = isImage(file.name, file.fileType);
          return (
            <div
              key={file.id}
              className="flex items-center justify-between px-4 py-4 border border-[var(--border)] rounded-xl mt-2 hover:bg-[var(--muted)]/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {isImg && file.url ? (
                  <div className="w-10 h-10 rounded-lg border border-[var(--border)] overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center flex-shrink-0 bg-white dark:bg-zinc-900">
                    <FileText size={18} className="text-[var(--muted-foreground)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">{file.name}</span>
                    {getBadge(file.fileType)}
                  </div>
                  {file.sourceContext && (
                    <span className="text-xs text-[var(--muted-foreground)] capitalize">
                      Source: {file.sourceContext.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                <span className="text-sm text-[var(--muted-foreground)] whitespace-nowrap">
                  {file.date}
                </span>
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                    title="Download / Open file"
                  >
                    <ArrowDownToLine size={16} />
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] opacity-40"
                    title="File stored in session"
                  >
                    <ArrowDownToLine size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
