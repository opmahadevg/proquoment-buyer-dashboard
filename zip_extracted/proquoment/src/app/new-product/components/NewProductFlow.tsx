'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';
import { useChat } from '@/lib/hooks/useChat';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import ChatButton from '@/components/ui/ChatButton';
import { ArrowRight, Eye, Send, Plus, Loader2, CheckCircle, Sparkles, Bot } from 'lucide-react';
import { saveProduct } from '@/lib/productStore';

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = 'intro' | 'transition' | 'choose' | 'builder';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  options?: string[];
  isStreaming?: boolean;
}

interface RFQData {
  productName: string;
  category: string;
  intendedUse: string;
  description: string;
  moq: string;
  specifications: { label: string; value: string; pending?: boolean }[];
  manufacturingNotes: { label: string; value: string; pending?: boolean }[];
  ambiguities: string[];
}

// ─── System prompt for conversational text (NO JSON) ─────────────────────────
const CHAT_SYSTEM_PROMPT = `You are an expert procurement RFQ agent for Proquoment, a B2B sourcing platform. Your role is to help buyers build a complete RFQ through natural conversation.

Your behavior:
1. Parse the buyer's product description and acknowledge what you understood.
2. Ask ONE focused follow-up question at a time to fill in missing details.
3. After each answer, briefly acknowledge it, then ask the next most important missing detail.
4. Keep questions concise and conversational.
5. When you want to offer choices, list them naturally in your message (e.g., "Would you prefer A, B, or C?").
6. After 5-8 exchanges, summarize what you have and ask if they're ready to finalize.

CRITICAL RULES:
- Respond ONLY with natural conversational text. 
- NEVER output JSON, code blocks, or structured data of any kind.
- NEVER use backticks or markdown code fences.
- Keep responses concise (2-4 sentences max).
- If you want to offer quick-reply options, end your message with a line starting with "OPTIONS:" followed by comma-separated choices (e.g., "OPTIONS: Brake pads, Oil filter, Headlight assembly").`;

// ─── System prompt for structured JSON extraction (NO conversational text) ───
const JSON_SYSTEM_PROMPT = `You are a data extraction agent. Based on the conversation provided, extract all known product details and return ONLY a valid JSON object. No explanations, no text, no markdown — just the raw JSON object.

The JSON must have this exact structure:
{
  "productName": "string",
  "category": "string",
  "intendedUse": "string",
  "description": "string",
  "moq": "string",
  "specifications": [
    { "label": "Dimensions", "value": "string", "pending": boolean },
    { "label": "Materials", "value": "string", "pending": boolean },
    { "label": "Colorways / Finish", "value": "string", "pending": boolean },
    { "label": "Components / Sub-Assemblies", "value": "string", "pending": boolean },
    { "label": "Hardware / Fasteners", "value": "string", "pending": boolean },
    { "label": "Packaging", "value": "string", "pending": boolean },
    { "label": "Branding / Labeling", "value": "string", "pending": boolean },
    { "label": "Surface Treatment / Coating", "value": "string", "pending": boolean },
    { "label": "Certifications / Standards", "value": "string", "pending": boolean }
  ],
  "manufacturingNotes": [
    { "label": "Production Process", "value": "string", "pending": boolean },
    { "label": "Tolerances", "value": "string", "pending": boolean },
    { "label": "Assembly Method", "value": "string", "pending": boolean },
    { "label": "Quality / Testing Requirements", "value": "string", "pending": boolean }
  ],
  "ambiguities": ["string"],
  "options": ["string"]
}

Rules:
- Use "(Pending)" as value and set pending: true for unknown fields.
- Keep all previously confirmed values — never reset them.
- The ambiguities array should list only genuinely unknown items.
- The options array should contain 2-4 short strings for quick-reply buttons if the last question has clear choices, otherwise use an empty array [].
- Return ONLY the JSON object. Nothing else.`;

const EMPTY_RFQ: RFQData = {
  productName: '',
  category: '',
  intendedUse: '',
  description: '',
  moq: '',
  specifications: [
    { label: 'Dimensions', value: '(Pending)', pending: true },
    { label: 'Materials', value: '(Pending)', pending: true },
    { label: 'Colorways / Finish', value: '(Pending)', pending: true },
    { label: 'Components / Sub-Assemblies', value: '(Pending)', pending: true },
    { label: 'Hardware / Fasteners', value: '(Pending)', pending: true },
    { label: 'Packaging', value: '(Pending)', pending: true },
    { label: 'Branding / Labeling', value: '(Pending)', pending: true },
    { label: 'Surface Treatment / Coating', value: '(Pending)', pending: true },
    { label: 'Certifications / Standards', value: '(Pending)', pending: true },
  ],
  manufacturingNotes: [
    { label: 'Production Process', value: '(Pending)', pending: true },
    { label: 'Tolerances', value: '(Pending)', pending: true },
    { label: 'Assembly Method', value: '(Pending)', pending: true },
    { label: 'Quality / Testing Requirements', value: '(Pending)', pending: true },
  ],
  ambiguities: [],
};

// ─── Parse options from conversational text ───────────────────────────────────
function extractOptionsFromText(text: string): { cleanText: string; options: string[] } {
  const optionsMatch = text.match(/OPTIONS:\s*(.+)$/m);
  if (!optionsMatch) return { cleanText: text.trim(), options: [] };
  const options = optionsMatch[1].split(',').map((o) => o.trim()).filter(Boolean);
  const cleanText = text.replace(/OPTIONS:\s*.+$/m, '').trim();
  return { cleanText, options };
}

// ─── Decorative crescent dot-pattern SVG ─────────────────────────────────────
function CrescentDots({ size = 220, rotate = 0, opacity = 1 }: { size?: number; rotate?: number; opacity?: number }) {
  const dots: React.ReactNode[] = [];
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.28;
  const dotR = size * 0.018;
  const spacing = dotR * 2.6;

  for (let x = 0; x < size; x += spacing) {
    for (let y = 0; y < size; y += spacing) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const shiftX = innerR * 0.55;
      const dx2 = x - (cx + shiftX);
      const dy2 = y - cy;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (dist <= outerR && dist2 > innerR * 0.9) {
        dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={dotR} fill="#3B35E8" opacity={0.55} />);
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `rotate(${rotate}deg)`, opacity }}>
      {dots}
    </svg>
  );
}

// ─── World map dot pattern ────────────────────────────────────────────────────
function WorldMapDots() {
  const mapData = [
    ...Array.from({ length: 40 }, (_, i) => ({ x: 120 + (i % 8) * 18, y: 80 + Math.floor(i / 8) * 18 })),
    ...Array.from({ length: 30 }, (_, i) => ({ x: 130 + (i % 6) * 18, y: 170 + Math.floor(i / 6) * 18 })),
    ...Array.from({ length: 20 }, (_, i) => ({ x: 200 + (i % 4) * 18, y: 280 + Math.floor(i / 4) * 18 })),
    ...Array.from({ length: 25 }, (_, i) => ({ x: 440 + (i % 5) * 18, y: 80 + Math.floor(i / 5) * 18 })),
    ...Array.from({ length: 30 }, (_, i) => ({ x: 450 + (i % 5) * 18, y: 200 + Math.floor(i / 5) * 18 })),
    ...Array.from({ length: 60 }, (_, i) => ({ x: 560 + (i % 10) * 18, y: 80 + Math.floor(i / 10) * 18 })),
    ...Array.from({ length: 40 }, (_, i) => ({ x: 580 + (i % 8) * 18, y: 200 + Math.floor(i / 8) * 18 })),
    ...Array.from({ length: 15 }, (_, i) => ({ x: 700 + (i % 5) * 18, y: 320 + Math.floor(i / 5) * 18 })),
  ];
  const supplierDots = [
    { x: 720, y: 180 }, { x: 740, y: 200 }, { x: 760, y: 190 }, { x: 780, y: 210 },
    { x: 800, y: 185 }, { x: 820, y: 200 }, { x: 840, y: 175 }, { x: 860, y: 195 },
    { x: 750, y: 220 }, { x: 770, y: 230 }, { x: 790, y: 215 }, { x: 810, y: 225 },
    { x: 300, y: 200 }, { x: 320, y: 210 }, { x: 340, y: 195 },
    { x: 460, y: 120 }, { x: 480, y: 130 }, { x: 500, y: 115 },
  ];

  return (
    <svg viewBox="0 0 1200 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {mapData.map((d, i) => <circle key={`land-${i}`} cx={d.x} cy={d.y} r={3} fill="#e5e7f0" />)}
      {supplierDots.map((d, i) => <circle key={`sup-${i}`} cx={d.x} cy={d.y} r={4} fill="#3B35E8" />)}
    </svg>
  );
}

// ─── Step 1: Intro ────────────────────────────────────────────────────────────
function IntroStep({ onNext }: { onNext: (product: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="absolute right-[8%] top-[5%] pointer-events-none"><CrescentDots size={200} rotate={-15} opacity={0.9} /></div>
      <div className="absolute right-[22%] top-[38%] pointer-events-none"><CrescentDots size={160} rotate={10} opacity={0.85} /></div>
      <div className="absolute right-[5%] top-[42%] pointer-events-none"><CrescentDots size={180} rotate={-5} opacity={0.8} /></div>

      <div className="flex flex-col justify-center min-h-screen px-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-8 leading-tight">
          What product are we sourcing today?
        </h1>
        <div className="bg-white border border-[var(--border)] rounded-2xl shadow-sm p-6 mb-4">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ceramic plate, 26 cm diameter, high-fire stoneware, glossy white food-safe glaze with cobalt blue rim, kiln-fired center logo. 2000 units."
            className="w-full h-36 resize-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none bg-transparent leading-relaxed"
          />
        </div>
        <p className="text-sm text-[var(--muted-foreground)] italic mb-8">
          More detail helps us match you with the right manufacturers.
        </p>
        <button
          onClick={() => value.trim() && onNext(value.trim())}
          disabled={!value.trim()}
          className="flex items-center gap-2 px-7 py-3.5 bg-primary text-white rounded-full text-base font-semibold w-fit hover:bg-[#2e29c4] active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start <ArrowRight size={18} />
        </button>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Step 2: Transition ───────────────────────────────────────────────────────
function TransitionStep({ productText, onNext }: { productText: string; onNext: () => void }) {
  const productName = deriveProductName(productText);

  useEffect(() => {
    const t = setTimeout(onNext, 2800);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="absolute inset-0 flex items-center justify-end pr-0">
        <div className="w-[65%] h-[70%] opacity-80"><WorldMapDots /></div>
      </div>
      <div className="relative flex flex-col justify-center min-h-screen px-16 max-w-2xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-6">Perfect! Let&apos;s dive in</h1>
        <p className="text-lg text-[var(--foreground)] mb-4 leading-relaxed">
          Finding manufacturers for: <span className="text-primary font-semibold">{productName}</span>
        </p>
        <p className="text-lg text-[var(--foreground)] leading-relaxed">
          Nice - I&apos;ve already found <span className="text-primary font-bold text-xl">165</span> suppliers that could be a great fit
        </p>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Step 3: Choose RFQ method ────────────────────────────────────────────────
const RFQ_OPTIONS = [
  {
    id: 'complete',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="1" width="13" height="17" rx="2" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M7 6h6M7 9h6M7 12h4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 15l2 2 4-4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'I have a complete RFQ',
    description: 'Upload your RFQ and supporting documents',
  },
  {
    id: 'partial',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="1" width="13" height="17" rx="2" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M7 6h6M7 9h4" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="4" stroke="#3B35E8" strokeWidth="1.5" />
        <path d="M16 14v2l1 1" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'I have partial details',
    description: "Upload what you have, and we'll help fill in the gaps",
  },
  {
    id: 'scratch',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="9" stroke="#3B35E8" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M11 7v4l3 3" stroke="#3B35E8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "I\'m starting from scratch",
    description: 'Build your RFQ with guided questions',
  },
];

function ChooseStep({ onNext }: { onNext: (method: string) => void }) {
  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-6 left-8">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors">
          <span className="text-base">‹</span> Back to Home
        </Link>
      </div>
      <div className="flex flex-col justify-center min-h-screen px-16 max-w-3xl">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-10">
          Choose how you want to build your RFQ
        </h1>
        <div className="space-y-4">
          {RFQ_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onNext(opt.id)}
              className="w-full flex items-center gap-5 px-6 py-5 bg-[var(--muted)]/50 hover:bg-[var(--secondary)] border border-[var(--border)] hover:border-primary/30 rounded-xl transition-all duration-150 group text-left"
            >
              <div className="flex-shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] mb-0.5">{opt.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{opt.description}</p>
              </div>
              <ArrowRight size={18} className="text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#6c63ff] flex items-center justify-center flex-shrink-0 shadow-sm">
        <Bot size={14} className="text-white" />
      </div>
      <div className="bg-white border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onOptionClick, isLoading }: { msg: Message; onOptionClick: (opt: string) => void; isLoading: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-fadeIn">
        <div className="max-w-[72%]">
          <div className="bg-primary text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm leading-relaxed">
            {msg.text}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 mb-4 animate-fadeIn">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#6c63ff] flex items-center justify-center flex-shrink-0 shadow-sm self-start mt-0.5">
        <Bot size={14} className="text-white" />
      </div>
      <div className="flex-1 max-w-[80%]">
        <div className="bg-white border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
          {msg.isStreaming && !msg.text ? (
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <div className="text-sm text-[var(--foreground)] leading-relaxed prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-strong:text-[var(--foreground)] prose-strong:font-semibold">
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          )}
        </div>
        {!msg.isStreaming && msg.options && msg.options.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {msg.options.map((opt) => (
              <button
                key={opt}
                onClick={() => onOptionClick(opt)}
                disabled={isLoading}
                className="px-3.5 py-1.5 text-xs font-medium border border-primary/30 bg-primary/5 rounded-full text-primary hover:bg-primary hover:text-white hover:border-primary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RFQ Panel ────────────────────────────────────────────────────────────────
function RFQPanel({ rfq, rfqTitle, finalized, isLoading, onFinalize }: {
  rfq: RFQData;
  rfqTitle: string;
  finalized: boolean;
  isLoading: boolean;
  onFinalize: () => void;
}) {
  const filledSpecs = rfq.specifications.filter((s) => !s.pending);
  const pendingSpecs = rfq.specifications.filter((s) => s.pending);
  const filledNotes = rfq.manufacturingNotes.filter((n) => !n.pending);
  const pendingNotes = rfq.manufacturingNotes.filter((n) => n.pending);
  const totalFields = rfq.specifications.length + rfq.manufacturingNotes.length + 5;
  const filledFields = filledSpecs.length + filledNotes.length +
    (rfq.productName ? 1 : 0) + (rfq.category ? 1 : 0) +
    (rfq.intendedUse ? 1 : 0) + (rfq.description ? 1 : 0) + (rfq.moq ? 1 : 0);
  const completionPct = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">RFQ Draft</span>
        </div>
        <h2 className="text-base font-bold text-[var(--foreground)] leading-snug line-clamp-2">{rfqTitle || 'New Product RFQ'}</h2>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--muted-foreground)]">Completion</span>
            <span className="text-xs font-semibold text-primary">{completionPct}%</span>
          </div>
          <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-[#6c63ff] rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Basic info */}
        {(rfq.productName || rfq.category || rfq.intendedUse || rfq.description || rfq.moq) ? (
          <div className="space-y-2.5">
            {rfq.productName && (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] min-w-[110px] flex-shrink-0">Product</span>
                <span className="text-[var(--foreground)] font-medium">{rfq.productName}</span>
              </div>
            )}
            {rfq.category && (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] min-w-[110px] flex-shrink-0">Category</span>
                <span className="text-[var(--foreground)] font-medium">{rfq.category}</span>
              </div>
            )}
            {rfq.intendedUse && (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] min-w-[110px] flex-shrink-0">Intended Use</span>
                <span className="text-[var(--foreground)]">{rfq.intendedUse}</span>
              </div>
            )}
            {rfq.description && (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] min-w-[110px] flex-shrink-0">Description</span>
                <span className="text-[var(--foreground)]">{rfq.description}</span>
              </div>
            )}
            {rfq.moq && (
              <div className="flex gap-2 text-sm">
                <span className="text-[var(--muted-foreground)] min-w-[110px] flex-shrink-0">MOQ</span>
                <span className="text-[var(--foreground)] font-medium">{rfq.moq}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={18} className="text-primary" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              RFQ details will appear here as the conversation progresses…
            </p>
          </div>
        )}

        {/* Specifications */}
        {(filledSpecs.length > 0 || pendingSpecs.length > 0) && (
          <div>
            <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-primary rounded-full inline-block" />
              Specifications
            </h3>
            <div className="space-y-1.5">
              {filledSpecs.map((spec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  <span className="text-[var(--muted-foreground)] min-w-[120px] flex-shrink-0">{spec.label}</span>
                  <span className="text-[var(--foreground)] font-medium">{spec.value}</span>
                </div>
              ))}
              {pendingSpecs.map((spec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs opacity-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] mt-1.5 flex-shrink-0" />
                  <span className="text-[var(--muted-foreground)] min-w-[120px] flex-shrink-0">{spec.label}</span>
                  <span className="text-[var(--muted-foreground)] italic">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manufacturing Notes */}
        {(filledNotes.length > 0 || pendingNotes.length > 0) && (
          <div>
            <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-[#6c63ff] rounded-full inline-block" />
              Manufacturing Notes
            </h3>
            <div className="space-y-1.5">
              {filledNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  <span className="text-[var(--muted-foreground)] min-w-[120px] flex-shrink-0">{note.label}</span>
                  <span className="text-[var(--foreground)] font-medium">{note.value}</span>
                </div>
              ))}
              {pendingNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-xs opacity-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)] mt-1.5 flex-shrink-0" />
                  <span className="text-[var(--muted-foreground)] min-w-[120px] flex-shrink-0">{note.label}</span>
                  <span className="text-[var(--muted-foreground)] italic">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ambiguities */}
        {rfq.ambiguities.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-1 h-3 bg-amber-400 rounded-full inline-block" />
              Pending Clarifications
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {rfq.ambiguities.map((item, i) => (
                <span key={i} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Finalize button */}
      <div className="px-6 py-4 border-t border-[var(--border)] bg-white">
        <button
          onClick={onFinalize}
          disabled={finalized || isLoading || (!rfq.productName && !rfqTitle)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-[#2e29c4] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-primary/20"
        >
          {finalized ? (
            <><CheckCircle size={16} /> RFQ Finalized!</>
          ) : (
            <><CheckCircle size={16} /> Finalize RFQ &amp; Add to Products</>
          )}
        </button>
        <p className="text-xs text-[var(--muted-foreground)] text-center mt-2">
          This will add the product to your sourcing list
        </p>
      </div>
    </div>
  );
}

// ─── Step 4: RFQ Builder (Dual Gemini calls) ──────────────────────────────────
function BuilderStep({ productText, productName }: { productText: string; productName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rfqTitle, setRfqTitle] = useState(productName || 'New Product RFQ');
  const [rfq, setRfq] = useState<RFQData>({ ...EMPTY_RFQ });
  const [panelOpen, setPanelOpen] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Streaming hook for conversational text only
  const { response: streamingResponse, isLoading: isStreaming, error: streamError, sendMessage: sendStreamingMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash-lite', true);

  // Show toast on error
  useEffect(() => {
    if (streamError) {
      const msg = streamError.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
        toast.error('AI is busy — please wait a moment and try again.', { duration: 5000 });
      } else {
        toast.error(msg);
      }
    }
  }, [streamError]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update streaming AI message in real-time (text only, guaranteed clean)
  useEffect(() => {
    if (!streamingResponse) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.isStreaming) {
        const { cleanText } = extractOptionsFromText(streamingResponse);
        return [...prev.slice(0, -1), { ...last, text: cleanText }];
      }
      return prev;
    });
  }, [streamingResponse]);

  // When streaming completes: finalize message + fire separate JSON call (every other turn to reduce quota usage)
  const jsonCallCounterRef = useRef(0);
  useEffect(() => {
    if (!isStreaming && streamingResponse && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.isStreaming) {
        const { cleanText, options: inlineOptions } = extractOptionsFromText(streamingResponse);

        // Finalize the streaming message with clean text
        const finalMsg: Message = {
          ...last,
          text: cleanText,
          isStreaming: false,
          options: inlineOptions.length > 0 ? inlineOptions : undefined,
        };
        setMessages((prev) => [...prev.slice(0, -1), finalMsg]);

        // Add to conversation history
        const updatedHistory = [...conversationHistory, { role: 'assistant', content: cleanText }];
        setConversationHistory(updatedHistory);

        // Fire JSON extraction every other AI response to halve API usage
        jsonCallCounterRef.current += 1;
        if (jsonCallCounterRef.current % 2 === 1) {
          fireJsonExtractionCall(updatedHistory, finalMsg, inlineOptions);
        } else {
          // On skipped turns, still apply inline options if present
          if (inlineOptions.length > 0) {
            setMessages((prev) => {
              const l = prev[prev.length - 1];
              if (l?.id === finalMsg.id) {
                return [...prev.slice(0, -1), { ...l, options: inlineOptions }];
              }
              return prev;
            });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Second Gemini call: extract structured JSON for RFQ panel (with retry on 429)
  const fireJsonExtractionCall = useCallback(async (
    history: { role: string; content: string }[],
    finalMsg: Message,
    inlineOptions: string[]
  ) => {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 7000;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 7s, 14s, 28s
          await new Promise((res) => setTimeout(res, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
        }

        const jsonMessages = [
          { role: 'system', content: JSON_SYSTEM_PROMPT },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: 'Extract the current RFQ data from the conversation above as JSON.' },
        ];

        const result = await getChatCompletion('GEMINI', 'gemini/gemini-2.5-flash-lite', jsonMessages, {
          temperature: 0.1,
          max_tokens: 2048,
        });

        const rawContent: string = result?.choices?.[0]?.message?.content || '';

        // Parse JSON — strip any accidental markdown fences
        let jsonStr = rawContent.trim();
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(jsonStr);
        const { options: jsonOptions, ...rfqUpdate } = parsed;

        // Update RFQ panel
        setRfq((prev) => {
          const updated = { ...prev };
          if (rfqUpdate.productName) { updated.productName = rfqUpdate.productName; setRfqTitle(rfqUpdate.productName); }
          if (rfqUpdate.category) updated.category = rfqUpdate.category;
          if (rfqUpdate.intendedUse) updated.intendedUse = rfqUpdate.intendedUse;
          if (rfqUpdate.description) updated.description = rfqUpdate.description;
          if (rfqUpdate.moq) updated.moq = rfqUpdate.moq;
          if (rfqUpdate.specifications?.length) updated.specifications = rfqUpdate.specifications;
          if (rfqUpdate.manufacturingNotes?.length) updated.manufacturingNotes = rfqUpdate.manufacturingNotes;
          if (rfqUpdate.ambiguities) updated.ambiguities = rfqUpdate.ambiguities;
          return updated;
        });

        // If JSON call returned options and inline didn't have any, update the message
        const finalOptions = inlineOptions.length > 0 ? inlineOptions : (jsonOptions || []);
        if (finalOptions.length > 0 && inlineOptions.length === 0) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === finalMsg.id) {
              return [...prev.slice(0, -1), { ...last, options: finalOptions }];
            }
            return prev;
          });
        }

        // Success — exit retry loop
        return;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota');

        if (isRateLimit && attempt < MAX_RETRIES - 1) {
          // Will retry after backoff delay
          continue;
        }
        // Final attempt failed or non-rate-limit error — fail silently (chat still works)
      }
    }
  }, []);

  // Initialize conversation
  const initializeConversation = useCallback(() => {
    if (initialized || !productText) return;
    setInitialized(true);

    const userContent = `I want to source the following product: ${productText}`;
    const initialHistory = [{ role: 'user', content: userContent }];
    setConversationHistory(initialHistory);

    setMessages([{ id: 'user-init', role: 'user', text: productText }]);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...initialHistory],
      { temperature: 0.7, max_tokens: 1024 }
    );
  }, [initialized, productText, sendStreamingMessage]);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || isProcessing) return;

    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    const newHistory = [...conversationHistory, { role: 'user', content: trimmed }];
    setConversationHistory(newHistory);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...newHistory],
      { temperature: 0.7, max_tokens: 1024 }
    );
  };

  const handleFinalize = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const title = rfqTitle || rfq.productName || deriveProductName(productText);

    saveProduct({
      id: `prod-rfq-${Date.now()}`,
      name: title,
      category: rfq.category,
      description: rfq.description,
      moq: rfq.moq,
      specifications: rfq.specifications,
      manufacturingNotes: rfq.manufacturingNotes,
      status: 'New Update',
      stage: 'Quoting',
      updated: dateStr,
      image: '',
      imageAlt: `${title} product`,
    });

    setFinalized(true);
    toast.success('RFQ finalized! Product added to your list.');
    setTimeout(() => router.push('/products-list'), 1200);
  };

  const isDisabled = isStreaming || isProcessing;

  return (
    <div className="relative min-h-screen bg-[#f8f8fc] flex flex-col">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '10px' } }} />

      {/* Top bar */}
      <div className="flex items-center px-6 py-3.5 border-b border-[var(--border)] bg-white z-10 shadow-sm">
        <Link href="/products-list" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-primary transition-colors mr-6">
          <span className="text-base">‹</span> Back to Home
        </Link>
        <div className="flex-1 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-[var(--muted-foreground)]">AI RFQ Agent · Active</span>
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--muted)] border border-[var(--border)]"
        >
          <Eye size={13} />
          {panelOpen ? 'Hide RFQ' : 'Show RFQ'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Left: Chat panel */}
        <div className={`flex flex-col transition-all duration-300 ${panelOpen ? 'w-[52%]' : 'w-full'}`}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)] bg-white">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#6c63ff] flex items-center justify-center shadow-sm">
              <Bot size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Proquoment AI</p>
              <p className="text-xs text-[var(--muted-foreground)]">RFQ Specialist</p>
            </div>
            <div className="ml-auto">
              <input
                value={rfqTitle}
                onChange={(e) => setRfqTitle(e.target.value)}
                className="text-xs font-medium text-primary border-b border-primary/30 bg-transparent outline-none pb-0.5 max-w-[180px] text-right"
                placeholder="RFQ Title"
              />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onOptionClick={handleSend}
                isLoading={isDisabled}
              />
            ))}
            {isDisabled && messages[messages.length - 1]?.role === 'user' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-4 border-t border-[var(--border)] bg-white">
            <div className="flex items-end gap-2">
              <div className="flex-1 border border-[var(--border)] rounded-2xl bg-[#f8f8fc] focus-within:border-primary/50 focus-within:bg-white transition-all duration-150 overflow-hidden">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputValue);
                    }
                  }}
                  placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={isDisabled}
                  className="w-full px-4 pt-3 pb-1 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none bg-transparent disabled:opacity-60 leading-relaxed"
                />
                <div className="flex items-center justify-between px-4 pb-2.5">
                  <button className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-primary transition-colors">
                    <Plus size={12} /> Attach file
                  </button>
                  <span className="text-xs text-[var(--muted-foreground)]/60">Shift+Enter for new line</span>
                </div>
              </div>
              <button
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || isDisabled}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2e29c4] active:scale-95 shadow-sm shadow-primary/30 flex-shrink-0 mb-1"
              >
                {isDisabled ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: RFQ Summary panel */}
        {panelOpen && (
          <div className="flex-1 overflow-hidden border-l border-[var(--border)] bg-white flex flex-col">
            <RFQPanel
              rfq={rfq}
              rfqTitle={rfqTitle}
              finalized={finalized}
              isLoading={isDisabled}
              onFinalize={handleFinalize}
            />
          </div>
        )}
      </div>

      <ChatButton />
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function deriveProductName(text: string): string {
  const words = text.split(' ').slice(0, 8).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function NewProductFlow() {
  const [step, setStep] = useState<Step>('intro');
  const [productText, setProductText] = useState('');

  const productName = deriveProductName(productText);

  if (step === 'intro') {
    return <IntroStep onNext={(text) => { setProductText(text); setStep('transition'); }} />;
  }
  if (step === 'transition') {
    return <TransitionStep productText={productText} onNext={() => setStep('choose')} />;
  }
  if (step === 'choose') {
    return <ChooseStep onNext={() => setStep('builder')} />;
  }
  return <BuilderStep productText={productText} productName={productName} />;
}
