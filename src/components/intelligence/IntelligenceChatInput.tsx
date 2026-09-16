'use client';

import React, { useState, useRef } from 'react';
import { Send, Zap, Paperclip, FileText, X, Image as ImageIcon } from 'lucide-react';
import { ResearchDepth } from '@/lib/intelligence/core';
import { IntelligenceAttachment } from '@/lib/intelligence/store';

interface Props {
  onSend: (query: string, depth: ResearchDepth, attachments?: IntelligenceAttachment[]) => void;
  disabled?: boolean;
  variant?: 'home' | 'chat';
  onOpenImageSearch?: () => void;
}

export const IntelligenceChatInput: React.FC<Props> = ({
  onSend,
  disabled,
  variant = 'home',
  onOpenImageSearch,
}) => {
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState<ResearchDepth>('standard');
  const [attachments, setAttachments] = useState<IntelligenceAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAddFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const newItems: IntelligenceAttachment[] = [];

    for (const file of list) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 25MB limit.`);
        continue;
      }
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

      if (!isImage && !isPdf) {
        alert(`File "${file.name}" is not supported. Please upload images or PDF specification sheets.`);
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        newItems.push({
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: file.size,
          dataUrl,
        });
      } catch (err) {
        console.error('Failed to read attached file:', err);
      }
    }

    if (newItems.length > 0) {
      setAttachments((prev) => [...prev, ...newItems]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    const queryText = trimmed || (attachments.length > 0 ? `Please analyze the attached specification files (${attachments.map(a => a.name).join(', ')}) and initiate comprehensive sourcing research.` : '');
    onSend(queryText, depth, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      {/* Main Input Box with Drag & Drop */}
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          className={`bg-white dark:bg-zinc-900 border ${
            isDragging
              ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950/60 bg-indigo-50/20 dark:bg-indigo-950/20'
              : 'border-zinc-200 dark:border-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-2 focus-within:ring-zinc-100 dark:focus-within:ring-zinc-800/80'
          } rounded-2xl md:rounded-3xl shadow-xs p-3 transition`}
        >
          {/* Attached Files Preview Strip */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2.5 pt-0.5 border-b border-zinc-100 dark:border-zinc-800/80 mb-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200/70 dark:border-zinc-700/70 text-xs text-zinc-800 dark:text-zinc-200 group transition animate-in fade-in zoom-in-95 duration-150"
                >
                  {att.type.startsWith('image/') ? (
                    <div className="w-5 h-5 rounded-md overflow-hidden bg-zinc-200 shrink-0 relative border border-zinc-300 dark:border-zinc-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <span className="font-medium truncate max-w-[140px] text-[11px]" title={att.name}>
                    {att.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {att.size ? `${(att.size / 1024).toFixed(0)}KB` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="w-4 h-4 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition cursor-pointer ml-0.5"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              variant === 'chat'
                ? attachments.length > 0
                  ? 'Add notes or specific instructions for attached files...'
                  : 'Type your answer, or attach specification sheets / images...'
                : attachments.length > 0
                ? 'Add notes or question for attached documents...'
                : "Ask anything, or attach product images & PDFs (e.g. spec sheets, CAD, CoA)..."
            }
            rows={variant === 'chat' ? (attachments.length > 0 ? 2 : 1) : 2}
            disabled={disabled}
            className="w-full bg-transparent resize-none border-0 focus:ring-0 text-sm text-[#0D0D14] dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden p-1 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
            {/* Left Controls: Attach Button & Depth Selector */}
            <div className="flex items-center gap-2">
              {/* Attach Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition cursor-pointer shadow-2xs"
                title="Attach specification sheets, PDFs, or reference images"
              >
                <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                <span>Attach</span>
                {attachments.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {attachments.length}
                  </span>
                )}
              </button>

              {/* Reference Images Search Button */}
              {onOpenImageSearch && (
                <button
                  type="button"
                  onClick={onOpenImageSearch}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-medium text-indigo-700 dark:text-indigo-300 transition cursor-pointer shadow-2xs"
                  title="Search & select reference product images"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Reference Images</span>
                </button>
              )}

              {/* Depth Selector */}
              <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setDepth('quick')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                    depth === 'quick'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Quick
                </button>
                <button
                  type="button"
                  onClick={() => setDepth('standard')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition text-xs ${
                    depth === 'standard'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setDepth('deep')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition text-xs ${
                    depth === 'deep'
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  Deep Research
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={(!input.trim() && attachments.length === 0) || disabled}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 text-white disabled:opacity-30 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
              title="Send inquiry"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
