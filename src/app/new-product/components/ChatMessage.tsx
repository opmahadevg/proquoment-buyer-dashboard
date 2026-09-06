import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle } from 'lucide-react';
import { type Message } from './NewProductFlow';
import { VisualValidationCard } from './VisualValidationCard';

const THINKING_STATES = [
  'Understanding your requirements',
  'Analyzing specifications',
  'Finding suitable suppliers',
  'Checking compliance requirements',
  'Building your procurement options',
];

export function TypingIndicator() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % THINKING_STATES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 py-3 mb-2 text-sm text-gray-500 font-medium">
      <span>{THINKING_STATES[textIndex]}</span>
      <div className="flex items-center gap-1 ml-1 mt-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-indigo-400 thinking-dot"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
export function MessageBubble({
  msg,
  onOptionClick,
  onCorrect,
  isLoading,
  onConfirmVisual,
  onChangeVisual,
  onProceedWithoutImage,
}: {
  msg: Message;
  onOptionClick: (opt: string) => void;
  onCorrect?: (text: string) => void;
  isLoading: boolean;
  onConfirmVisual?: (cardId: string) => void;
  onChangeVisual?: (cardId: string) => void;
  onProceedWithoutImage?: (cardId: string) => void;
}) {
  const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<Set<string>>(new Set());
  const [multiConfirmed, setMultiConfirmed] = useState(false);

  const handleSingleSelect = (opt: string) => {
    if (isLoading || selectedSingle) return;
    setSelectedSingle(opt);
    onOptionClick(opt);
  };

  const handleMultiToggle = (opt: string) => {
    if (isLoading || multiConfirmed) return;
    setSelectedMulti((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) {
        next.delete(opt);
      } else {
        next.add(opt);
      }
      return next;
    });
  };

  const handleMultiConfirm = () => {
    if (isLoading || multiConfirmed || selectedMulti.size === 0) return;
    setMultiConfirmed(true);
    onOptionClick(Array.from(selectedMulti).join(', '));
  };

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5 mb-6 group">
        {msg.images && msg.images.length > 0 && (
          <div className="flex flex-row flex-wrap justify-end gap-2 mb-1">
            {msg.images.map((img: any, i: number) => {
              const url = typeof img === 'string' ? img : (img.url || img.thumbnail);
              const title = typeof img === 'string' ? `Reference ${i + 1}` : (img.title || `Reference ${i + 1}`);
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (url) window.open(url, '_blank');
                  }}
                  title="Click to view full image"
                  className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200/90 shadow-sm bg-gray-50 flex-shrink-0 cursor-pointer hover:opacity-90 hover:scale-105 transition-all"
                >
                  <img
                    src={url}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end items-center gap-1.5">
          {onCorrect && (
            <button
              onClick={() => onCorrect(msg.text)}
              title="Correct this answer"
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-gray-400 hover:text-primary transition-all duration-150 px-2 py-1 rounded-lg hover:bg-gray-50 flex-shrink-0"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Correct
            </button>
          )}
          <div className="bg-[#F0F0F2] text-[#0D0D14] text-sm px-4 py-2.5 rounded-2xl max-w-[80%] leading-relaxed">
            {msg.text}
          </div>
        </div>
      </div>
    );
  }

  const isMultiSelect = msg.multiSelect === true;

  return (
    <div className="mb-7">
      {/* AI message body — plain prose, no bubble */}
      {msg.isStreaming && !msg.text ? (
        <TypingIndicator />
      ) : (
        <div
          className="text-[15px] text-[#0D0D14] leading-[1.7] prose prose-sm max-w-none
          prose-p:my-1.5 prose-p:text-[15px] prose-p:text-[#0D0D14]
          prose-strong:font-semibold prose-strong:text-[#0D0D14]
          prose-ul:my-2 prose-ul:space-y-1.5 prose-li:text-[15px] prose-li:text-[#0D0D14] prose-li:my-0
          [&_li]:list-none [&_ul]:pl-0"
        >
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
      )}

      {/* Visual Validation Card if present */}
      {msg.visualCard && (
        <div className="mt-2 mb-2">
          <VisualValidationCard
            card={msg.visualCard}
            onLooksRight={() => onConfirmVisual?.(msg.visualCard!.id)}
            onChangeSomething={() => onChangeVisual?.(msg.visualCard!.id)}
            onProceedWithoutImage={() => onProceedWithoutImage?.(msg.visualCard!.id)}
            isProcessing={isLoading}
          />
        </div>
      )}

      {/* Quick-reply chips — only on last non-streaming message */}
      {!msg.isStreaming && msg.options && msg.options.length > 0 && (
        <div className="mt-4">
          {/* Issue #8: multi-select hint */}
          {isMultiSelect && !multiConfirmed && (
            <p className="text-xs text-gray-400 mb-2">Select all that apply</p>
          )}
          {/* Issue #1: chips use whitespace-nowrap to prevent truncation */}
          <div className="flex flex-wrap gap-2">
            {msg.options.map((opt, idx) => {
              const isSingleSelected = !isMultiSelect && selectedSingle === opt;
              const isMultiSelected = isMultiSelect && selectedMulti.has(opt);
              const isSelected = isSingleSelected || isMultiSelected;
              const isDisabledSingle = !isMultiSelect && (isLoading || !!selectedSingle);
              const isDisabledMulti = isMultiSelect && (isLoading || multiConfirmed);
              return (
                <button
                  key={`${idx}-${opt}`}
                  onClick={() => isMultiSelect ? handleMultiToggle(opt) : handleSingleSelect(opt)}
                  disabled={isDisabledSingle || isDisabledMulti}
                  className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0
                    ${
                      isSelected
                        ? 'bg-[#0D0D14] border-[#0D0D14] text-white'
                        : (isDisabledSingle || isDisabledMulti)
                          ? 'border-gray-200 text-gray-300 bg-white'
                          : 'border-gray-300 text-[#0D0D14] bg-white hover:border-[#0D0D14] hover:bg-[#F5F5F8]'
                    }`}
                >
                  {isSelected && <CheckCircle size={12} className="inline mr-1.5 -mt-0.5" />}
                  {opt}
                </button>
              );
            })}
          </div>
          {/* Issue #8: confirm button for multi-select */}
          {isMultiSelect && !multiConfirmed && selectedMulti.size > 0 && (
            <button
              onClick={handleMultiConfirm}
              className="mt-3 px-4 py-1.5 bg-[#0D0D14] text-white text-sm font-semibold rounded-full hover:bg-[#1a1a26] transition-colors"
            >
              Confirm ({selectedMulti.size} selected)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
