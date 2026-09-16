'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Search, ChevronRight, Upload, SkipForward, Check,
  Loader2, ImageOff, GripVertical,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ImageResult {
  position: number;
  title: string;
  thumbnail: string;
  original: string;
}

export interface SelectedImage extends ImageResult {
  note: string;
}

export interface ImageSearchStepProps {
  productText: string;
  rfqId: string;
  onNext: (selectedImages?: SelectedImage[]) => void;
  onSkip: () => void;
  origin?: 'rfq' | 'intelligence';
  intelligenceSessionId?: string;
  onIntelligenceReturn?: (images: SelectedImage[]) => void;
}



// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--muted)] animate-pulse aspect-[4/3]" />
  );
}

// ─── Single image card in the grid ───────────────────────────────────────────
function ImageCard({
  img,
  isSelected,
  onSelect,
  onDeselect,
}: {
  img: ImageResult;
  isSelected: boolean;
  onSelect: (img: ImageResult) => void;
  onDeselect: (pos: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  // H5 FIX: derive src from props instead of stale useState — reset on key change
  const [useFallback, setUseFallback] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = errored ? '' : (useFallback ? img.thumbnail : (img.original || img.thumbnail));

  const handleClick = () => {
    if (isSelected) {
      onDeselect(img.position);
    } else {
      onSelect(img);
    }
  };

  const handleError = () => {
    if (!useFallback && img.thumbnail && img.thumbnail !== img.original) {
      setUseFallback(true);
    } else {
      setErrored(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative group rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
        isSelected
          ? 'border-[var(--primary)] shadow-lg shadow-primary/20'
          : 'border-transparent hover:border-[var(--primary)]/40 hover:shadow-md'
      }`}
      onClick={handleClick}
    >
      {/* Image container — consistent 4:3 aspect ratio with contain fit */}
      <div
        className="w-full bg-[#f5f5f5] flex items-center justify-center"
        style={{ aspectRatio: '4/3' }}
      >
        {!errored ? (
          <img
            src={src}
            alt={img.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-contain transition-all duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setLoaded(true)}
            onError={handleError}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[var(--muted-foreground)]">
            <ImageOff size={20} className="opacity-40" />
            <span className="text-[10px] opacity-50">No preview</span>
          </div>
        )}

        {/* Loading pulse */}
        {!loaded && !errored && (
          <div className="absolute inset-0 bg-[var(--muted)] animate-pulse rounded-2xl" />
        )}
      </div>



      {/* Selected overlay */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--primary)]/20"
          >
            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-md">
              <Check size={13} className="text-white" strokeWidth={3} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover ring */}
      {!isSelected && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200 rounded-2xl" />
      )}
    </motion.div>
  );
}

// ─── Selected image row in sidebar ───────────────────────────────────────────
function SelectedRow({
  item,
  index,
  onRemove,
  onNoteChange,
}: {
  item: SelectedImage;
  index: number;
  onRemove: (pos: number) => void;
  onNoteChange: (pos: number, note: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex gap-3 p-3 bg-white rounded-xl border border-[var(--border)] group"
    >
      {/* Drag handle (visual only) */}
      <div className="flex-shrink-0 flex items-start pt-1 text-[var(--muted-foreground)] opacity-40">
        <GripVertical size={14} />
      </div>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[#f5f5f5] border border-[var(--border)] flex items-center justify-center">
        <img
          src={item.original || item.thumbnail}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
          onError={(e) => {
            const t = e.target as HTMLImageElement;
            if (t.src !== item.thumbnail) {
              t.src = item.thumbnail;
            } else {
              t.style.display = 'none';
            }
          }}
        />
      </div>

      {/* Note input + remove */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1.5">
          <p className="text-[11px] font-semibold text-[var(--foreground)] truncate">
            Ref {index + 1}
          </p>
        </div>
        <input
          type="text"
          placeholder="What do you like? (optional)"
          value={item.note}
          onChange={(e) => onNoteChange(item.position, e.target.value)}
          className="w-full text-[11px] text-[var(--foreground)] bg-[var(--muted)]/50 border border-[var(--border)] rounded-lg px-2.5 py-1.5 placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)]/40 transition-colors"
        />
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.position)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-[var(--muted)] flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-[var(--muted-foreground)]"
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImageSearchStep({
  productText,
  rfqId,
  onNext,
  onSkip,
  origin = 'rfq',
  intelligenceSessionId,
  onIntelligenceReturn,
}: ImageSearchStepProps) {
  const [query, setQuery] = useState(productText || '');
  const [refinedQuery, setRefinedQuery] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-search when query or productText changes (or on initial load)
  useEffect(() => {
    const target = query || productText || 'product photo';
    doSearch(target, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(async (q: string, skipRefine = false) => {
    const searchTarget = q.trim() || 'sourcing product photo';

    // Cancel any in-flight request so stale results never overwrite fresh ones
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResults([]);        // clear old images immediately — no stale display
    setRefinedQuery('');   // clear old refined-query badge
    setError('');
    setHasSearched(true);
    try {
      const res = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTarget, skipRefine }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.images || []);
      if (data.refinedQuery && data.refinedQuery !== searchTarget) {
        setRefinedQuery(data.refinedQuery);
      }
    } catch (err: unknown) {
      // Ignore aborted requests — user started a new search
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Could not load images. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);


  // H6 FIX: select/deselect/note by URL (original), not position — avoids cross-search collision
  const handleSelect = (img: ImageResult) => {
    if (selected.length >= 8) return;
    if (selected.some(s => s.original === img.original)) return; // prevent dupes
    setSelected((prev) => [...prev, { ...img, note: '' }]);
  };

  const handleDeselect = (posOrUrl: number | string) => {
    setSelected((prev) => prev.filter((s) =>
      typeof posOrUrl === 'string' ? s.original !== posOrUrl : s.position !== posOrUrl
    ));
  };

  const handleNoteChange = (pos: number, note: string) => {
    setSelected((prev) => prev.map((s) => s.position === pos ? { ...s, note } : s));
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      if (origin === 'intelligence' && onIntelligenceReturn) {
        onIntelligenceReturn([]);
      } else {
        onNext([]);
      }
      return;
    }
    setSaving(true);
    try {
      const payload = selected.map((s) => ({
        url: s.original,
        thumbnail: s.thumbnail,
        title: s.note ? `${s.title} — ${s.note}` : s.title,
        position: s.position,
      }));

      // M3 FIX: store visual intent in localStorage for BuilderStep or Intelligence to pick up
      const imageUrls = payload.map(img => img.url);
      fetch('/api/ai/analyze-visual-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageUrls, productName: productText })
      }).then(res => res.json())
        .then(data => {
          if (data?.data?.compact_summary || data?.data?.observations) {
            try {
              localStorage.setItem(`visual_intent_${rfqId}`, JSON.stringify(data.data));
            } catch {}
          }
        }).catch(e => console.warn('Background visual intent analysis failed:', e));

      // In RFQ flow, persist to rfq_images. In Intelligence flow, defer until RFQ launch.
      if (origin !== 'intelligence') {
        await fetch('/api/rfq-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rfqId, images: payload }),
        });
      }
    } catch (e) {
      console.error('Failed to save reference images:', e);
    } finally {
      setSaving(false);
      if (origin === 'intelligence' && onIntelligenceReturn) {
        onIntelligenceReturn(selected);
      } else {
        onNext(selected);
      }
    }
  };

  // H6 FIX: track by URL not position
  const selectedUrls = new Set(selected.map((s) => s.original));

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-[var(--border)] px-4 md:px-8 py-3 flex items-center justify-between">
        {origin === 'intelligence' ? (
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            <span className="text-base">‹</span> Back to Sourcing Advisor
          </button>
        ) : (
          <Link
            href="/products-list"
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <span className="text-base">‹</span> Back
          </Link>
        )}

        {/* Step indicator */}
        {origin === 'intelligence' ? (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40">
              Proquoment Intelligence
            </span>
            <span className="text-xs font-medium text-zinc-500 hidden sm:inline">
              Reference Visuals
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {['Describe', 'Method', 'Visuals', 'Build'].map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    i < 2 ? 'bg-[var(--primary)] text-white'
                    : i === 2 ? 'bg-[var(--primary)] text-white ring-4 ring-[var(--primary)]/20'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}>
                    {i < 2 ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </div>
                  <span className={`text-[11px] font-medium hidden sm:block ${
                    i === 2 ? 'text-[var(--primary)]' : i < 2 ? 'text-[var(--muted-foreground)]' : 'text-[var(--muted-foreground)]/60'
                  }`}>{label}</span>
                </div>
                {i < 3 && <div className="w-6 h-px bg-[var(--border)]" />}
              </React.Fragment>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          {origin === 'intelligence' ? 'Cancel' : 'Skip'} <SkipForward size={14} />
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Search + Results ── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col gap-5">
          {/* Header */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mb-1">
              Find visual references
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Pick images that resemble what you want to source. Your AI builder will use them.
            </p>
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim() && !loading) {
                doSearch(query, false);
              }
            }}
            className="flex gap-2"
          >
            <div className="flex-1 flex items-center gap-2 bg-white border border-[var(--border)] rounded-xl px-3.5 py-2.5 focus-within:border-[var(--primary)]/50 focus-within:ring-2 focus-within:ring-[var(--primary)]/10 transition-all">
              <Search size={15} className="text-[var(--muted-foreground)] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe what you're looking for…"
                className="flex-1 text-sm bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* AI Refine button */}
            <button
              type="submit"
              disabled={loading || !query.trim()}
              title="AI-refine and search"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/30"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              <span className="hidden sm:inline">{loading ? 'Searching…' : 'AI Search'}</span>
            </button>

            {/* Manual search */}
            <button
              type="button"
              onClick={() => doSearch(query, true)}
              disabled={loading || !query.trim()}
              title="Search without AI refinement"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-[var(--border)] text-[var(--foreground)] text-sm font-medium hover:bg-[var(--muted)]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Search size={15} />
            </button>
          </form>



          {/* Refined query badge */}
          <AnimatePresence>
            {refinedQuery && refinedQuery !== query && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 flex-wrap -mt-2"
              >
                <span className="text-xs text-[var(--muted-foreground)]">AI refined to:</span>
                <span
                  className="text-xs font-medium text-[var(--primary)] bg-[var(--secondary)] border border-[var(--primary)]/20 rounded-full px-2.5 py-1 cursor-pointer hover:bg-[var(--primary)]/10 transition-colors"
                  onClick={() => { setQuery(refinedQuery); doSearch(refinedQuery, true); }}
                >
                  {refinedQuery}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">← click to reuse</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Image grid ── */}
          {loading && !results.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <>
              {/* Results count */}
              <div className="flex items-center gap-2 -mb-2">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {results.length} results · filtered for product photography
                </span>
              </div>

              <motion.div
                className="grid grid-cols-2 md:grid-cols-3 gap-3"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
              >
                {results.map((img) => (
                  <motion.div
                    // H5 FIX: key by URL+position so React remounts on new search
                    key={`${img.original || img.thumbnail}-${img.position}`}
                    variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  >
                    <ImageCard
                      img={img}
                      // H6 FIX: isSelected by URL
                      isSelected={selectedUrls.has(img.original)}
                      onSelect={handleSelect}
                      onDeselect={handleDeselect}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </>
          ) : hasSearched && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
              <ImageOff size={32} className="opacity-40" />
              <p className="text-sm">No images found. Try a different query or remove a chip filter.</p>
            </div>
          ) : null}

          {results.length >= 15 && (
            <p className="text-center text-xs text-[var(--muted-foreground)] py-2">
              Showing top 15 results · filtered for quality. Refine your search for different results.
            </p>
          )}
        </div>

        {/* ── Right: Selected sidebar ── */}
        <div className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-[var(--border)] bg-white flex-shrink-0">
          {/* Sidebar header */}
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-0.5">
              <h2 className="text-sm font-bold text-[var(--foreground)]">Reference images</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                selected.length > 0
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}>
                {selected.length}/8
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Click images to add. Add notes on what you like.
            </p>
          </div>

          {/* Selected list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {selected.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 gap-3 text-center"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[var(--muted)] flex items-center justify-center">
                    <Upload size={20} className="text-[var(--muted-foreground)]" />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed max-w-[160px]">
                    Click any image to add it as a reference
                  </p>
                </motion.div>
              ) : (
                selected.map((item, i) => (
                  <SelectedRow
                    key={item.position}
                    item={item}
                    index={i}
                    onRemove={handleDeselect}
                    onNoteChange={handleNoteChange}
                  />
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar footer / submit */}
          <div className="px-4 py-4 border-t border-[var(--border)] flex flex-col gap-3">
            {selected.length > 0 && (
              <p className="text-[11px] text-[var(--muted-foreground)] text-center">
                {origin === 'intelligence'
                  ? 'Images will be added to your sourcing conversation'
                  : 'Images will be saved to your RFQ for supplier context'}
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/30"
            >
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Saving…</>
              ) : selected.length > 0 ? (
                <>Continue with {selected.length} image{selected.length !== 1 ? 's' : ''} <ChevronRight size={15} /></>
              ) : (
                <>Continue without images <ChevronRight size={15} /></>
              )}
            </button>
            <button
              onClick={onSkip}
              className="w-full text-center text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-1"
            >
              Skip this step
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom bar (when images selected) ── */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] px-4 py-3 flex items-center gap-3 shadow-xl"
          >
            {/* Thumbnails strip */}
            <div className="flex gap-1.5 flex-1 overflow-hidden">
              {selected.slice(0, 5).map((s) => (
                <div key={s.position} className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-[var(--border)] bg-[#f5f5f5] flex items-center justify-center">
                  <img
                    src={s.original || s.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      if (t.src !== s.thumbnail) t.src = s.thumbnail;
                    }}
                  />
                </div>
              ))}
              {selected.length > 5 && (
                <div className="w-9 h-9 rounded-lg bg-[var(--muted)] flex items-center justify-center text-[11px] font-bold text-[var(--muted-foreground)] flex-shrink-0">
                  +{selected.length - 5}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-60 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Continue ({selected.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
