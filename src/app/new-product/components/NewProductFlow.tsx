'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '@/lib/hooks/useChat';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import ChatButton from '@/components/ui/ChatButton';
import { Globe } from '@/components/ui/cobe-globe';
import {
  ArrowRight,
  Eye,
  EyeOff,
  ArrowUp,
  Loader2,
  CheckCircle,
  ChevronRight,
  Paperclip,
  UploadCloud,
  X,
  FileText,
  CheckCircle2,
  Circle,
  CircleDotDashed,
  Save,
  AlertTriangle,
  ScanSearch,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { saveProduct } from '@/lib/productStore';
import { submitRFQ, saveDraftRFQ, fetchDraftRFQ, deleteDraftRFQ } from '@/lib/services/procurementApi';
import { useAuth } from '@/contexts/AuthContext';
import ImageSearchStep from './ImageSearchStep';

import { MessageBubble, TypingIndicator } from './ChatMessage';
import { RFQPanel } from './RFQPanel';
import BuilderStep from './BuilderStep';
// ─── Types ───────────────────────────────────────────────────────────────────
export type Step = 'intro' | 'transition' | 'choose' | 'upload' | 'extracting' | 'review' | 'image-search' | 'builder';
export type RFQMethod = 'complete' | 'partial' | 'scratch';

export interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  options?: string[];
  multiSelect?: boolean; // Issue #8 — multi-select chip support
  isStreaming?: boolean;
  images?: { url: string; title?: string }[];
}

export interface RFQData {
  productName: string;
  category: string;
  intendedUse: string;
  description: string;
  moq: string;
  specifications: { label: string; value: string; pending?: boolean }[];
  manufacturingNotes: { label: string; value: string; pending?: boolean }[];
  commercialTerms: { label: string; value: string; pending?: boolean }[]; // Issue #5 #6
  ambiguities: string[];
  categoryRelevantFields: string[]; // Issue #2 — dynamic field filtering
  missingFields?: string[]; // Fields not found in uploaded documents
}

// ─── System prompt for conversational text (NO JSON) ─────────────────────────
export const CHAT_SYSTEM_PROMPT = `You are a precision procurement RFQ agent for Proquoment, a B2B international sourcing platform. Help the buyer build a complete, manufacturer-ready RFQ through intelligent, focused questions.

RESPONSE FORMAT — follow this structure exactly every time:
1. One short sentence confirming or acknowledging the last answer (skip on first message).
2. **Bold question** — the single most important missing specification.
3. Bullet list of 3–4 options in this exact format:
   • **Option Name** – brief explanation or example with real numbers/units
   • **Option Name** – brief explanation or example with real numbers/units
4. Optional: 💡 One concise tip about cost, quality, or certification impact.
5. REQUIRED final line using PIPE delimiter: OPTIONS: option1 | option2 | option3 | option4
   For multi-value fields (certifications, documents): OPTIONS[multi]: opt1 | opt2 | opt3 | opt4

BEHAVIOR:
- CRITICAL — CONFIRMED FIELDS: A "CONFIRMED FIELDS" block may appear at the end of this system prompt listing fields already answered. NEVER ask about ANY field listed there. Immediately skip to the next unconfirmed field in the priority order below. If the buyer already stated information in their first message (e.g. "king size electric heating quilts"), extract and acknowledge it — do not re-ask.
- Read the product description carefully. Skip any spec already provided.
- Ask ONE question per turn. Every option must include real numbers (mm, g/m², units, $, days).
- ADAPT questions to product CATEGORY. For food/spice/agricultural products: skip Dimensions, Colorways, Surface Treatment/Coating. For textiles: skip food-safety certs. For electronics: skip food certs, add RoHS/CE.

QUESTION PRIORITY — Two Phases:

PHASE 1 — PRODUCT UNDERSTANDING (ask these FIRST, in order):
Fully understand what the product IS before asking about quantities, pricing, or shipping.
  a. Material grade / quality standard — e.g. Grade A, 100% cotton, ISO 3632-1, food-grade, alloy type
  b. Dimensions (L × W × H) — physical size, only for products where relevant (skip for commodities/spices/chemicals)
  c. Unit Weight — weight per unit in g or kg, only where relevant
  d. Colorways / Finish — color options, surface finish, only for consumer goods / textiles / ceramics
  e. Branding / Labeling — private label, OEM, custom logo, label placement
  f. Surface Treatment / Coating — only for manufactured / industrial products (plating, anodizing, powder coat)
  g. Required certifications — HACCP, Halal, ISO 22000, FDA, UL, CE, RoHS, etc. (use OPTIONS[multi]: for this)
  h. Quality / Testing Requirements — AQL level, third-party inspection, lab test reports
  i. Production Process — injection molding, die-cast, woven, CNC, etc. (only if relevant to category)

PHASE 2 — COMMERCIAL & LOGISTICS (ask these AFTER product is understood):
  j. MOQ — minimum order quantity in units or kg
  k. Target price per unit/kg (USD) — IMPORTANT: always write full price e.g. $1,500/kg NOT abbreviated
  l. Packaging — units per carton, bag type, inner/outer packaging
  m. Lead time — days from purchase order
  n. Sample requirements — quantity, cost per sample, sample lead time
  o. Incoterms — FOB, CIF, EXW, DDP
  p. Payment terms — T/T advance %, L/C, D/P
  q. Port of loading — city and country
  r. Destination port — buyer's port
  s. Required documents — COA, COO, Phytosanitary, Bill of Lading, etc. (use OPTIONS[multi]: for this)

- Skip any field that is irrelevant to the product category (see ADAPT rule above).
- NEVER declare "I have everything I need" until ALL of the following are satisfied:
  1. ALL relevant Phase 1 fields are confirmed (product fully understood)
  2. At least MOQ, Target price, and ONE of: Incoterms / Payment Terms / Port of Loading are confirmed
  If not ready, continue asking the next most important question.
- When ready to finalize say: "Perfect, I have everything I need to build your RFQ." then:
  OPTIONS: Yes, finalize RFQ | Add one more detail

CRITICAL RULES:
- NEVER output raw JSON or code blocks.
- The OPTIONS: line is machine-parsed and NOT shown to the user — always include it.
- ALWAYS use pipe symbol | to separate options — NEVER use comma as option separator.
- Keep the confirmation sentence to 1 line max before the bold question.
- Bold option names: **Name** — then dash and description.
- Use realistic, product-specific numbers — never vague words like "small/medium/large" alone.
- For price options: always write full prices e.g. "$1,500/kg" not "$1" or "1500".

EXAMPLE (for saffron spice — Phase 1, material question):
**What grade and quality standard of saffron are you looking for?**
• **Grade A, ISO 3632-1** – premium threads, crocin ≥190, safranal ≥30, deep red color
• **Grade B, ISO 3632-2** – good quality, crocin ≥150, suitable for food processing
• **Pushali grade** – economy option, mixed stigma and style, crocin ≥120
• **Custom specification** – specify your own quality parameters

💡 ISO 3632-1 Grade A commands higher prices but ensures consistent color and flavor for retail markets.

OPTIONS: Grade A, ISO 3632-1 | Grade B, ISO 3632-2 | Pushali grade | Custom specification`;

// ─── System prompt for structured JSON extraction (NO conversational text) ───
// Keep the last N history messages to avoid token-limit errors across all providers.
// System prompt is always prepended separately, so this only trims conversation turns.
const MAX_HISTORY_MESSAGES = 40;
export function trimHistory(history: { role: string; content: string }[]) {
  return history.length > MAX_HISTORY_MESSAGES
    ? history.slice(history.length - MAX_HISTORY_MESSAGES)
    : history;
}

/**
 * Build a compact text summary of all confirmed (non-pending) RFQ fields.
 * Injected into the system prompt so the AI never re-asks answered questions,
 * even if old messages have been trimmed from conversation history.
 */
export function buildConfirmedFieldsSummary(rfq: RFQData): string {
  const lines: string[] = [];

  // Basic fields
  if (rfq.productName) lines.push(`- Product Name: ${rfq.productName}`);
  if (rfq.category) lines.push(`- Category: ${rfq.category}`);
  if (rfq.intendedUse) lines.push(`- Intended Use: ${rfq.intendedUse}`);
  if (rfq.moq) lines.push(`- MOQ: ${rfq.moq}`);

  // Specifications
  for (const spec of rfq.specifications) {
    if (!spec.pending && spec.value && spec.value !== '(Pending)') {
      lines.push(`- ${spec.label}: ${spec.value}`);
    }
  }

  // Manufacturing Notes
  for (const note of rfq.manufacturingNotes) {
    if (!note.pending && note.value && note.value !== '(Pending)') {
      lines.push(`- ${note.label}: ${note.value}`);
    }
  }

  // Commercial Terms
  for (const term of (rfq.commercialTerms || [])) {
    if (!term.pending && term.value && term.value !== '(Pending)') {
      lines.push(`- ${term.label}: ${term.value}`);
    }
  }

  if (lines.length === 0) return '';

  return `\n\nCONFIRMED FIELDS — these have already been answered by the buyer. Do NOT ask about any of these again. Move to the next UNANSWERED field in the priority list:\n${lines.join('\n')}`;
}

export const JSON_SYSTEM_PROMPT = `You are a data extraction agent. Based on the conversation provided, extract all known product details and return ONLY a valid JSON object. No explanations, no text, no markdown — just the raw JSON object.

The JSON must have this exact structure:
{
  "productName": "string",
  "category": "string",
  "intendedUse": "string",
  "description": "string — IMPORTANT: Write a complete, professional, supplier-facing product brief synthesized from ALL information gathered in the conversation. Do NOT just echo the buyer's first message. Include product name, grade, quality standards, certifications, quantity, packaging requirements, and any other confirmed specs. Format as 2-3 sentences a supplier can act on.",
  "moq": "string",
  "specifications": [
    { "label": "Materials / Grade", "value": "string", "pending": boolean },
    { "label": "Target Unit Price", "value": "string", "pending": boolean },
    { "label": "Packaging", "value": "string", "pending": boolean },
    { "label": "Certifications / Standards", "value": "string", "pending": boolean },
    { "label": "Dimensions (L × W × H)", "value": "string", "pending": boolean },
    { "label": "Unit Weight", "value": "string", "pending": boolean },
    { "label": "Colorways / Finish", "value": "string", "pending": boolean },
    { "label": "Branding / Labeling", "value": "string", "pending": boolean },
    { "label": "Surface Treatment / Coating", "value": "string", "pending": boolean }
  ],
  "manufacturingNotes": [
    { "label": "Production Process", "value": "string", "pending": boolean },
    { "label": "Dimensional Tolerances", "value": "string", "pending": boolean },
    { "label": "Lead Time (days)", "value": "string", "pending": boolean },
    { "label": "Quality / Testing Requirements", "value": "string", "pending": boolean }
  ],
  "commercialTerms": [
    { "label": "Incoterms", "value": "string", "pending": boolean },
    { "label": "Payment Terms", "value": "string", "pending": boolean },
    { "label": "Port of Loading", "value": "string", "pending": boolean },
    { "label": "Destination Port", "value": "string", "pending": boolean },
    { "label": "Sample Requirements", "value": "string", "pending": boolean },
    { "label": "Required Documents", "value": "string", "pending": boolean }
  ],
  "categoryRelevantFields": ["string — list ONLY the specification/note field labels that are relevant for this product category. For food/spice/agricultural products omit: Dimensions (L × W × H), Colorways / Finish, Surface Treatment / Coating, Branding / Labeling. For textiles include all except Surface Treatment. For industrial/electronics include all. If unsure, include all."],
  "ambiguities": ["string"],
  "options": ["string"]
}

Rules:
- Always include units in values: mm, cm, g, kg, g/m², days, USD, %, etc.
- For numeric ranges confirmed by the buyer, write exactly what they said (e.g. "500–1,000 units", "30×20×10 cm", "±0.5 mm", "$5–$15/unit", "45–60 days").
- Use "(Pending)" as value and set pending: true for any field not yet discussed OR not relevant (but mark irrelevant fields in categoryRelevantFields instead of showing pending).
- CRITICAL: Never reset a field that was already confirmed — if a field had pending: false, it must stay pending: false with its value intact.
- Never regress: once a field is filled, never overwrite with (Pending).
- The description field MUST be a professional supplier brief, NOT the buyer's raw first message.
- The options array should contain 2–4 short strings separated by | (pipe) for quick-reply buttons, otherwise [].
- Return ONLY the JSON object. Nothing else.`;

export const EMPTY_RFQ: RFQData = {
  productName: '',
  category: '',
  intendedUse: '',
  description: '',
  moq: '',
  specifications: [
    { label: 'Materials / Grade', value: '(Pending)', pending: true },
    { label: 'Target Unit Price', value: '(Pending)', pending: true },
    { label: 'Packaging', value: '(Pending)', pending: true },
    { label: 'Certifications / Standards', value: '(Pending)', pending: true },
    { label: 'Dimensions (L × W × H)', value: '(Pending)', pending: true },
    { label: 'Unit Weight', value: '(Pending)', pending: true },
    { label: 'Colorways / Finish', value: '(Pending)', pending: true },
    { label: 'Branding / Labeling', value: '(Pending)', pending: true },
    { label: 'Surface Treatment / Coating', value: '(Pending)', pending: true },
  ],
  manufacturingNotes: [
    { label: 'Production Process', value: '(Pending)', pending: true },
    { label: 'Dimensional Tolerances', value: '(Pending)', pending: true },
    { label: 'Lead Time (days)', value: '(Pending)', pending: true },
    { label: 'Quality / Testing Requirements', value: '(Pending)', pending: true },
  ],
  // Issue #5 #6 — commercial terms for international procurement
  commercialTerms: [
    { label: 'Incoterms', value: '(Pending)', pending: true },
    { label: 'Payment Terms', value: '(Pending)', pending: true },
    { label: 'Port of Loading', value: '(Pending)', pending: true },
    { label: 'Destination Port', value: '(Pending)', pending: true },
    { label: 'Sample Requirements', value: '(Pending)', pending: true },
    { label: 'Required Documents', value: '(Pending)', pending: true },
  ],
  ambiguities: [],
  categoryRelevantFields: [], // Issue #2 — empty means show all; populated by AI
};

// ─── Parse options from conversational text ───────────────────────────────────
// Issue #1 fix: use | as delimiter to prevent $1,500/kg splitting into two chips
// Issue #8 fix: detect OPTIONS[multi]: prefix for multi-select questions
export function extractOptionsFromText(text: string): { cleanText: string; options: string[]; multiSelect: boolean } {
  // Match both OPTIONS: and OPTIONS[multi]: patterns
  const optionsMatch = text.match(/OPTIONS(?:\[(multi)\])?:\s*(.+)$/m);
  if (!optionsMatch) return { cleanText: text.trim(), options: [], multiSelect: false };
  const multiSelect = optionsMatch[1] === 'multi';
  const rawOptions = optionsMatch[2];
  // Use | as primary delimiter; fall back to , only when no | is present
  const delimiter = rawOptions.includes('|') ? '|' : ',';
  const options = rawOptions
    .split(delimiter)
    .map((o) => o.trim())
    .filter(Boolean);
  const cleanText = text.replace(/OPTIONS(?:\[multi\])?:\s*.+$/m, '').trim();
  return { cleanText, options, multiSelect };
}

// ─── Decorative crescent dot-pattern SVG ─────────────────────────────────────
function CrescentDots({
  size = 220,
  rotate = 0,
  opacity = 1,
}: {
  size?: number;
  rotate?: number;
  opacity?: number;
}) {
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
        dots.push(
          <circle key={`${x}-${y}`} cx={x} cy={y} r={dotR} fill="#3B35E8" opacity={0.55} />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: `rotate(${rotate}deg)`, opacity }}
    >
      {dots}
    </svg>
  );
}

// ─── World map dot pattern ────────────────────────────────────────────────────
function WorldMapDots() {
  const mapData = [
    ...Array.from({ length: 40 }, (_, i) => ({
      x: 120 + (i % 8) * 18,
      y: 80 + Math.floor(i / 8) * 18,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      x: 130 + (i % 6) * 18,
      y: 170 + Math.floor(i / 6) * 18,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      x: 200 + (i % 4) * 18,
      y: 280 + Math.floor(i / 4) * 18,
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      x: 440 + (i % 5) * 18,
      y: 80 + Math.floor(i / 5) * 18,
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      x: 450 + (i % 5) * 18,
      y: 200 + Math.floor(i / 5) * 18,
    })),
    ...Array.from({ length: 60 }, (_, i) => ({
      x: 560 + (i % 10) * 18,
      y: 80 + Math.floor(i / 10) * 18,
    })),
    ...Array.from({ length: 40 }, (_, i) => ({
      x: 580 + (i % 8) * 18,
      y: 200 + Math.floor(i / 8) * 18,
    })),
    ...Array.from({ length: 15 }, (_, i) => ({
      x: 700 + (i % 5) * 18,
      y: 320 + Math.floor(i / 5) * 18,
    })),
  ];
  const supplierDots = [
    { x: 720, y: 180 },
    { x: 740, y: 200 },
    { x: 760, y: 190 },
    { x: 780, y: 210 },
    { x: 800, y: 185 },
    { x: 820, y: 200 },
    { x: 840, y: 175 },
    { x: 860, y: 195 },
    { x: 750, y: 220 },
    { x: 770, y: 230 },
    { x: 790, y: 215 },
    { x: 810, y: 225 },
    { x: 300, y: 200 },
    { x: 320, y: 210 },
    { x: 340, y: 195 },
    { x: 460, y: 120 },
    { x: 480, y: 130 },
    { x: 500, y: 115 },
  ];

  return (
    <svg viewBox="0 0 1200 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {mapData.map((d, i) => (
        <circle key={`land-${i}`} cx={d.x} cy={d.y} r={3} fill="#e5e7f0" />
      ))}
      {supplierDots.map((d, i) => (
        <circle key={`sup-${i}`} cx={d.x} cy={d.y} r={4} fill="#3B35E8" />
      ))}
    </svg>
  );
}

// ─── Category quick-chips ─────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { label: '👕 Apparel & Textiles', value: 'Apparel or textile product' },
  { label: '🪑 Furniture', value: 'Furniture product' },
  { label: '🍶 Ceramics & Homeware', value: 'Ceramic or homeware product' },
  { label: '⚙️ Industrial Parts', value: 'Industrial or mechanical part' },
  { label: '📦 Packaging', value: 'Packaging material or box' },
  { label: '💄 Beauty & Personal Care', value: 'Beauty or personal care product' },
  { label: '🔌 Electronics', value: 'Electronic component or device' },
  { label: '🧴 Food & Beverage', value: 'Food or beverage product' },
];

// ─── Globe supplier markers (major manufacturing hubs) ────────────────────────
const SUPPLIER_MARKERS = [
  { id: 'shenzhen', location: [22.5, 114.1] as [number, number] },
  { id: 'shanghai', location: [31.2, 121.5] as [number, number] },
  { id: 'guangzhou', location: [23.1, 113.3] as [number, number] },
  { id: 'vietnam', location: [10.8, 106.7] as [number, number] },
  { id: 'mumbai', location: [19.1, 72.9] as [number, number] },
  { id: 'dhaka', location: [23.8, 90.4] as [number, number] },
  { id: 'istanbul', location: [41.0, 28.9] as [number, number] },
  { id: 'hamburg', location: [53.6, 10.0] as [number, number] },
  { id: 'london', location: [51.5, -0.1] as [number, number] },
  { id: 'mexico', location: [25.7, -100.3] as [number, number] },
  { id: 'losangeles', location: [34.0, -118.2] as [number, number] },
  { id: 'saopaulo', location: [-23.5, -46.6] as [number, number] },
  { id: 'seoul', location: [37.6, 126.9] as [number, number] },
  { id: 'taipei', location: [25.0, 121.5] as [number, number] },
  { id: 'jakarta', location: [-6.2, 106.8] as [number, number] },
];

// ─── Step 1: Intro ────────────────────────────────────────────────────────────
function IntroStep({ onNext }: { onNext: (product: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="relative min-h-screen bg-white overflow-hidden flex flex-col md:flex-row">
      {/* Back link */}
      <div className="absolute top-4 left-4 md:top-6 md:left-8 z-10">
        <Link
          href="/products-list"
          className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors"
        >
          <span className="text-base">‹</span> Back
        </Link>
      </div>

      {/* Left — content */}
      <div className="flex flex-col justify-center px-5 md:px-14 w-full md:w-[54%] min-w-0 pt-16 pb-8 md:pt-0 md:pb-0 md:min-h-screen">
        <h1 className="text-2xl md:text-4xl font-bold text-[var(--foreground)] mb-2 md:mb-3 leading-tight">
          What product are we sourcing today?
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-4 md:mb-6">
          Pick a category or describe your product below.
        </p>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-4 md:mb-5">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setValue((prev) => (prev ? prev : chip.value))}
              className="px-3 md:px-3.5 py-1.5 md:py-2 text-xs md:text-sm border border-[var(--border)] rounded-full hover:border-primary hover:bg-[var(--secondary)] hover:text-primary transition-all duration-150 text-[var(--foreground)] bg-white"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[var(--border)] rounded-2xl shadow-sm p-4 md:p-6 mb-3 md:mb-4 focus-within:border-primary/50 transition-colors">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Ceramic plate, 26 cm diameter, high-fire stoneware, glossy white food-safe glaze with cobalt blue rim. 2000 units."
            className="w-full h-24 md:h-28 resize-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none bg-transparent leading-relaxed"
          />
        </div>
        <p className="text-xs text-[var(--muted-foreground)] italic mb-5 md:mb-7">
          More detail = better manufacturer matches. Don&apos;t worry — the AI will ask follow-up
          questions.
        </p>
        <button
          onClick={() => value.trim() && onNext(value.trim())}
          disabled={!value.trim()}
          className="flex items-center gap-2 px-6 md:px-7 py-3 md:py-3.5 bg-primary text-white rounded-full text-sm md:text-base font-semibold w-fit hover:bg-[#2e29c4] active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start <ArrowRight size={18} />
        </button>
      </div>

      {/* Right — interactive globe (hidden on mobile) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center pr-8 pl-4 py-12">
        <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest mb-4">
          Verified manufacturers
        </p>
        <Globe
          markers={SUPPLIER_MARKERS}
          className="w-full max-w-[420px]"
          markerColor={[0.23, 0.21, 0.91]}
          baseColor={[1, 1, 1]}
          glowColor={[0.82, 0.82, 0.97]}
          dark={0}
          mapBrightness={9}
          markerSize={0.028}
          speed={0.0015}
          theta={0.25}
          diffuse={1.4}
        />
        <p className="text-[11px] text-[var(--muted-foreground)] mt-4 text-center">
          Drag to explore · Suppliers highlighted in blue
        </p>
      </div>

      <ChatButton />
    </div>
  );
}

// ─── Step 2: Transition — AI Agent Plan ──────────────────────────────────────
type TaskStatus = 'pending' | 'in-progress' | 'completed';

const AGENT_TASKS = [
  {
    id: '1',
    title: 'Analysing product description',
    subtasks: [
      'Extracting key specifications',
      'Identifying material requirements',
      'Parsing technical standards',
    ],
  },
  {
    id: '2',
    title: 'Scanning global supplier database',
    subtasks: [
      'Querying 12,000+ verified manufacturers',
      'Filtering by product category',
      'Applying geographic preferences',
    ],
  },
  {
    id: '3',
    title: 'Matching manufacturer capabilities',
    subtasks: [
      'Comparing MOQ & pricing bands',
      'Evaluating production capacity',
      'Checking lead time compatibility',
    ],
  },
  {
    id: '4',
    title: 'Verifying compliance & certifications',
    subtasks: [
      'Cross-checking required standards',
      'Validating audit records',
      'Reviewing quality certifications',
    ],
  },
  {
    id: '5',
    title: 'Preparing your shortlist',
    subtasks: [
      'Ranking by relevance score',
      'Finalising top manufacturer matches',
      'Ready to review',
    ],
  },
];

function StatusIcon({ status, size = 16 }: { status: TaskStatus; size?: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.7, rotate: -15 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.7, rotate: 15 }}
        transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
      >
        {status === 'completed' ? (
          <CheckCircle2 size={size} className="text-green-500" />
        ) : status === 'in-progress' ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <CircleDotDashed size={size} className="text-primary" />
          </motion.div>
        ) : (
          <Circle size={size} className="text-gray-200" />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function TransitionStep({ productText, onNext }: { productText: string; onNext: () => void }) {
  const productName = deriveProductName(productText);
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({
    '1': 'in-progress',
    '2': 'pending',
    '3': 'pending',
    '4': 'pending',
    '5': 'pending',
  });
  const [activeTask, setActiveTask] = useState('1');

  useEffect(() => {
    // Task sequence — each task takes ~900ms
    const advance = (id: string, nextId: string | null, delay: number) =>
      setTimeout(() => {
        setStatuses((p) => ({
          ...p,
          [id]: 'completed',
          ...(nextId ? { [nextId]: 'in-progress' } : {}),
        }));
        if (nextId) setActiveTask(nextId);
      }, delay);

    const t1 = advance('1', '2', 900);
    const t2 = advance('2', '3', 1800);
    const t3 = advance('3', '4', 2700);
    const t4 = advance('4', '5', 3500);
    const t5 = advance('5', null, 4300);
    const t6 = setTimeout(onNext, 4700);

    return () => {
      [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
    };
  }, [onNext]);

  return (
    <div className="relative min-h-screen bg-white flex flex-col md:flex-row overflow-hidden">
      <div className="absolute top-4 left-4 md:top-6 md:left-8 z-10">
        <Link
          href="/products-list"
          className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors"
        >
          <span className="text-base">‹</span> Back
        </Link>
      </div>

      {/* Left info panel */}
      <div className="flex flex-col justify-center px-5 md:px-16 w-full md:w-[42%] pt-16 pb-6 md:pt-0 md:pb-0 md:min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          <div className="flex items-center gap-2 mb-5 md:mb-7">
            <motion.span
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Proquoment AI Agent
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-1 leading-tight">
            Finding manufacturers
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold text-primary mb-5 md:mb-8 leading-tight truncate max-w-xs">
            {productName}
          </h2>

          <p className="text-xl md:text-2xl font-bold text-[var(--foreground)] mb-1">
            Suppliers Matched
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">from our verified global network</p>
        </motion.div>
      </div>

      {/* Right: Agent plan card */}
      <div className="flex-1 flex items-center justify-center px-5 md:px-10 py-8 md:py-20">
        <motion.div
          className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          {/* Card header */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Agent is working…
            </span>
          </div>

          {/* Task list */}
          <div className="p-4 space-y-0.5">
            {AGENT_TASKS.map((task) => {
              const status = statuses[task.id];
              const isActive = status === 'in-progress';
              const isDone = status === 'completed';

              return (
                <div key={task.id} className="relative">
                  {/* Vertical connector */}
                  {task.id !== '5' && (
                    <div className="absolute left-[15px] top-[26px] bottom-0 w-px border-l border-dashed border-gray-200" />
                  )}

                  <div
                    className={`flex items-start gap-3 px-2 py-1.5 rounded-lg transition-colors duration-300 ${isActive ? 'bg-blue-50/60' : ''}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <StatusIcon status={status} size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug transition-colors duration-300 ${
                          isDone
                            ? 'text-gray-400 line-through'
                            : isActive
                              ? 'text-[var(--foreground)] font-medium'
                              : 'text-gray-400'
                        }`}
                      >
                        {task.title}
                      </p>

                      {/* Subtasks — shown only when active */}
                      <AnimatePresence>
                        {isActive && (
                          <motion.ul
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
                            className="mt-1.5 space-y-1 overflow-hidden"
                          >
                            {task.subtasks.map((sub, i) => (
                              <motion.li
                                key={sub}
                                className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08, duration: 0.2, ease: 'easeOut' }}
                              >
                                <span className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0" />
                                {sub}
                              </motion.li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Right status badge */}
                    <AnimatePresence>
                      {isDone && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-shrink-0 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-0.5"
                        >
                          done
                        </motion.span>
                      )}
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5"
                        >
                          running
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
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
        <path
          d="M14 15l2 2 4-4"
          stroke="#3B35E8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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

function ChooseStep({ onNext }: { onNext: (method: RFQMethod) => void }) {
  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute top-4 left-4 md:top-6 md:left-8">
        <Link
          href="/products-list"
          className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors"
        >
          <span className="text-base">‹</span> Back
        </Link>
      </div>
      <div className="flex flex-col justify-center min-h-screen px-5 md:px-16 max-w-3xl pt-16 md:pt-0">
        <h1 className="text-2xl md:text-4xl font-bold text-[var(--foreground)] mb-6 md:mb-10">
          Choose how you want to build your RFQ
        </h1>
        <div className="space-y-3 md:space-y-4">
          {RFQ_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onNext(opt.id as RFQMethod)}
              className="w-full flex items-center gap-4 md:gap-5 px-4 md:px-6 py-4 md:py-5 bg-[var(--muted)]/50 hover:bg-[var(--secondary)] border border-[var(--border)] hover:border-primary/30 rounded-xl transition-all duration-150 group text-left"
            >
              <div className="flex-shrink-0">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] mb-0.5">{opt.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{opt.description}</p>
              </div>
              <ArrowRight
                size={18}
                className="text-primary flex-shrink-0 group-hover:translate-x-1 transition-transform"
              />
            </button>
          ))}
        </div>
      </div>
      <ChatButton />
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
export function deriveProductName(text: string): string {
  const words = text.split(' ').slice(0, 8).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Step: Upload RFQ files ───────────────────────────────────────────────────
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function UploadStep({
  method,
  onBack,
  onSkip,
  onSubmit,
}: {
  method: RFQMethod;
  onBack: () => void;
  onSkip: () => void;
  onSubmit: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMb = (totalSize / 1024 / 1024).toFixed(1);
  const isOverLimit = totalSize > MAX_UPLOAD_BYTES;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setSizeError(null);
    const accepted = Array.from(incoming).filter((f) =>
      /\.(pdf|doc|docx|png|jpg|jpeg|webp|gif)$/i.test(f.name)
    );
    const newFiles = [...files];
    const existing = new Set(files.map((f) => f.name));
    for (const f of accepted) {
      if (!existing.has(f.name)) newFiles.push(f);
    }
    const newTotal = newFiles.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_UPLOAD_BYTES) {
      setSizeError(`Total size ${(newTotal / 1024 / 1024).toFixed(1)} MB exceeds the 50 MB limit. Remove some files.`);
    }
    setFiles(newFiles);
  };

  const removeFile = (name: string) => {
    setSizeError(null);
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const isPartial = method === 'partial';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back */}
      <div className="px-4 md:px-8 pt-4 md:pt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors"
        >
          <span className="text-base">‹</span> Back
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col md:flex-row flex-1 items-start gap-8 md:gap-12 px-4 md:px-8 pt-6 md:pt-10 max-w-5xl">
        {/* Left text */}
        <div className="flex-1 min-w-0 md:pt-2">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-3 leading-tight">
            {isPartial ? 'Upload what you have' : 'Great! Upload your complete RFQ'}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {isPartial
              ? "Upload any existing specs, briefs, or reference images. Our AI will extract what's there and ask about what's missing."
              : 'Upload your complete RFQ document. AI will extract all specifications and pre-populate your RFQ automatically.'}
          </p>

          {/* What we extract */}
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">What we extract automatically:</p>
            {[
              'Product specifications & dimensions',
              'Materials, grades & certifications',
              'MOQ, pricing & commercial terms',
              'Incoterms, ports & payment terms',
              'Lead times & quality requirements',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>



          {isPartial && (
            <p className="text-xs text-[var(--muted-foreground)] mt-4 italic">
              Don&apos;t have anything? Skip straight to the AI builder below.
            </p>
          )}
        </div>

        {/* Upload zone */}
        <div className="w-full md:w-[420px] md:flex-shrink-0">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 h-56 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-150 ${
              dragging
                ? 'border-primary bg-[var(--secondary)] scale-[1.01]'
                : isOverLimit
                  ? 'border-red-300 bg-red-50'
                  : 'border-[var(--border)] bg-[var(--muted)]/40 hover:border-primary/50 hover:bg-[var(--secondary)]/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border ${
              isOverLimit ? 'bg-red-50 border-red-200' : 'bg-white border-[var(--border)]'
            }`}>
              <UploadCloud size={22} className={isOverLimit ? 'text-red-400' : 'text-[var(--muted-foreground)]'} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {files.length > 0 ? 'Add more files' : 'Click or drag to upload'}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                PDF, DOC, DOCX, PNG, JPG — max 50 MB total
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* Size indicator */}
          {files.length > 0 && (
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-xs text-[var(--muted-foreground)]">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              <span className={`text-xs font-semibold ${
                isOverLimit ? 'text-red-500' : totalSize > MAX_UPLOAD_BYTES * 0.8 ? 'text-amber-500' : 'text-[var(--muted-foreground)]'
              }`}>
                {totalSizeMb} / 50 MB
              </span>
            </div>
          )}

          {/* Size error */}
          {sizeError && (
            <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-600">{sizeError}</p>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)]"
                >
                  <FileText size={14} className="text-primary flex-shrink-0" />
                  <span className="flex-1 text-xs text-[var(--foreground)] truncate">{f.name}</span>
                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                    className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 md:px-8 pb-6 md:pb-8 mt-auto pt-6">
        <button
          onClick={onSkip}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <span className="text-base">‹</span>{' '}
          <span className="hidden sm:inline">I don&apos;t have anything yet</span>
          <span className="sm:hidden">Skip</span>
        </button>
        <button
          onClick={() => !isOverLimit && onSubmit(files)}
          disabled={files.length === 0 || isOverLimit}
          className="flex items-center gap-2 px-5 md:px-7 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-[#2e29c4] active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ScanSearch size={15} /> Extract & Analyse
        </button>
      </div>
    </div>
  );
}

// ─── Step: Extracting (animated progress screen) ──────────────────────────────
const EXTRACTION_TASKS = [
  { id: '1', label: 'Reading uploaded documents', detail: 'Parsing PDF text layers & images' },
  { id: '2', label: 'Extracting text & tables', detail: 'Identifying specifications and figures' },
  { id: '3', label: 'Running AI analysis', detail: 'Recognizing product fields' },
  { id: '4', label: 'Building your RFQ', detail: 'Structuring data into Proquoment format' },
];

function ExtractionStep({
  files,
  method,
  onComplete,
  onError,
}: {
  files: File[];
  method: RFQMethod;
  onComplete: (rfqData: Partial<RFQData>, extractedText: string, designQuery?: string, designAttributes?: string[]) => void;
  onError: (message: string) => void;
}) {
  const [activeTask, setActiveTask] = useState('1');
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({
    '1': 'in-progress',
    '2': 'pending',
    '3': 'pending',
    '4': 'pending',
  });
  const [statusMessage, setStatusMessage] = useState('Starting extraction…');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const advance = (done: string, next: string | null, msg: string) => {
        setStatuses((p) => ({
          ...p,
          [done]: 'completed',
          ...(next ? { [next]: 'in-progress' } : {}),
        }));
        if (next) setActiveTask(next);
        setStatusMessage(msg);
      };

      try {
        // Task 1: build formData
        await new Promise((r) => setTimeout(r, 600));
        advance('1', '2', `Extracting from ${files.length} file${files.length !== 1 ? 's' : ''}…`);

        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));

        // Task 2: upload + extraction starts
        await new Promise((r) => setTimeout(r, 500));
        advance('2', '3', 'AI is analysing your documents…');

        const res = await fetch('/api/extract-rfq', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok || data.error) {
          onError(data.error || 'Extraction failed. Please try again.');
          return;
        }

        // Task 3 → 4
        advance('3', '4', 'Structuring RFQ fields…');
        await new Promise((r) => setTimeout(r, 600));
        advance('4', null, `Done! Extracted ${data.filesProcessed} file${data.filesProcessed !== 1 ? 's' : ''}.`);

        await new Promise((r) => setTimeout(r, 700));
        onComplete(
          data.rfqData as Partial<RFQData>,
          data.extractedText || '',
          data.designQuery || '',
          data.designAttributes || []
        );
      } catch (err: any) {
        onError(err?.message || 'An unexpected error occurred during extraction.');
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen bg-white flex flex-col md:flex-row overflow-hidden">
      {/* Left */}
      <div className="flex flex-col justify-center px-5 md:px-16 w-full md:w-[42%] pt-16 pb-6 md:pt-0 md:pb-0 md:min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          <div className="flex items-center gap-2 mb-5">
            <motion.span
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              Proquoment AI Agent
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] mb-1 leading-tight">
            Extracting your RFQ
          </h1>
          <h2 className="text-base text-primary font-medium mb-4 truncate max-w-xs">
            {files.map((f) => f.name).join(', ')}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">{statusMessage}</p>
        </motion.div>
      </div>

      {/* Right: task card */}
      <div className="flex-1 flex items-center justify-center px-5 md:px-10 py-8 md:py-20">
        <motion.div
          className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0.65, 0.3, 0.9] }}
        >
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              Extraction in progress…
            </span>
          </div>
          <div className="p-4 space-y-0.5">
            {EXTRACTION_TASKS.map((task) => {
              const status = statuses[task.id];
              const isActive = status === 'in-progress';
              const isDone = status === 'completed';
              return (
                <div key={task.id} className="relative">
                  {task.id !== '4' && (
                    <div className="absolute left-[15px] top-[26px] bottom-0 w-px border-l border-dashed border-gray-200" />
                  )}
                  <div className={`flex items-start gap-3 px-2 py-1.5 rounded-lg transition-colors duration-300 ${isActive ? 'bg-blue-50/60' : ''}`}>
                    <div className="mt-0.5 flex-shrink-0">
                      <StatusIcon status={status} size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug transition-colors duration-300 ${
                        isDone ? 'text-gray-400 line-through' : isActive ? 'text-[var(--foreground)] font-medium' : 'text-gray-400'
                      }`}>
                        {task.label}
                      </p>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-[var(--muted-foreground)] mt-0.5 overflow-hidden"
                          >
                            {task.detail}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <AnimatePresence>
                      {isDone && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-shrink-0 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-0.5"
                        >
                          done
                        </motion.span>
                      )}
                      {isActive && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5"
                        >
                          running
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Step: Review extracted RFQ (complete + partial with data) ────────────────
function ReviewStep({
  rfqData,
  method,
  onSubmit,
  onRefineWithAI,
  onBack,
  productText,
}: {
  rfqData: Partial<RFQData>;
  method: RFQMethod;
  onSubmit: () => void;
  onRefineWithAI: () => void;
  onBack: () => void;
  productText: string;
}) {
  const [editedRfq, setEditedRfq] = useState<Partial<RFQData>>(rfqData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const allSpecs = editedRfq.specifications || [];
  const allNotes = editedRfq.manufacturingNotes || [];
  const allCommercial = editedRfq.commercialTerms || [];
  const missingFields = editedRfq.missingFields || [];

  const filledSpecs = allSpecs.filter((s) => !s.pending).length;
  const filledNotes = allNotes.filter((n) => !n.pending).length;
  const filledCommercial = allCommercial.filter((c) => !c.pending).length;
  const totalFilled = filledSpecs + filledNotes + filledCommercial +
    (editedRfq.productName ? 1 : 0) + (editedRfq.moq ? 1 : 0) + (editedRfq.category ? 1 : 0);
  const totalFields = allSpecs.length + allNotes.length + allCommercial.length + 3;
  const completionPct = totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

  const startEdit = (key: string, current: string) => {
    setEditingField(key);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (!editingField) return;
    const [section, label] = editingField.split('::');
    if (section === 'basic') {
      setEditedRfq((prev) => ({ ...prev, [label]: editValue }));
    } else {
      const sectionKey = section as 'specifications' | 'manufacturingNotes' | 'commercialTerms';
      setEditedRfq((prev) => ({
        ...prev,
        [sectionKey]: (prev[sectionKey] || []).map((item) =>
          item.label === label ? { ...item, value: editValue, pending: false } : item
        ),
      }));
    }
    setEditingField(null);
  };

  const EditableField = ({ sectionKey, label, value, pending }: {
    sectionKey: string; label: string; value: string; pending?: boolean;
  }) => {
    const key = `${sectionKey}::${label}`;
    const isEditing = editingField === key;
    return (
      <li className="flex items-start gap-2 text-sm leading-snug group">
        <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
              className="flex-1 text-sm border border-primary rounded-lg px-2 py-1 outline-none"
            />
            <button onClick={commitEdit} className="text-xs text-primary font-semibold">Save</button>
            <button onClick={() => setEditingField(null)} className="text-xs text-gray-400">✕</button>
          </div>
        ) : (
          <span className={`flex-1 ${pending ? 'text-gray-400 italic' : 'text-[#0D0D14]'}`}>
            <span className="font-semibold">{label}:</span>{' '}
            {pending ? '(Not found in document)' : value}
            {!pending && (
              <button
                onClick={() => startEdit(key, value)}
                className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary"
              >
                <Pencil size={11} />
              </button>
            )}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 pt-4 md:pt-6 pb-4 border-b border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--foreground)] hover:text-primary transition-colors"
        >
          <span className="text-base">‹</span> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)]">
            {completionPct}% extracted
          </span>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%`, backgroundColor: completionPct >= 70 ? '#16a34a' : '#3B35E8' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">
                Review Extracted RFQ
              </h1>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] ml-7">
              {method === 'complete'
                ? 'AI extracted the following from your uploaded documents. Review and edit any field before submitting.'
                : 'Here\'s what we found in your documents. Click "Refine with AI" to fill in the missing fields via chat.'}
            </p>
          </div>

          {/* Basic Info */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
            <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Product Overview</p>
            <div className="space-y-2">
              {[
                { key: 'basic::productName', label: 'Product Name', value: editedRfq.productName || '' },
                { key: 'basic::category', label: 'Category', value: editedRfq.category || '' },
                { key: 'basic::moq', label: 'MOQ', value: editedRfq.moq || '' },
                { key: 'basic::intendedUse', label: 'Intended Use', value: editedRfq.intendedUse || '' },
              ].filter((f) => f.value).map(({ key, label, value }) => {
                const isEditing = editingField === key;
                return (
                  <div key={key} className="flex items-center gap-2 text-sm group">
                    <span className="text-[var(--muted-foreground)] w-28 flex-shrink-0 text-xs">{label}:</span>
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                          className="flex-1 text-sm border border-primary rounded-lg px-2 py-1 outline-none"
                        />
                        <button onClick={commitEdit} className="text-xs text-primary font-semibold">Save</button>
                        <button onClick={() => setEditingField(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <span className="flex-1 font-semibold text-[#0D0D14]">
                        {value}
                        <button
                          onClick={() => startEdit(key, value)}
                          className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary"
                        >
                          <Pencil size={11} />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {editedRfq.description && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-[var(--muted-foreground)] font-semibold mb-1">Description</p>
                <p className="text-xs text-gray-600 leading-relaxed">{editedRfq.description}</p>
              </div>
            )}
          </div>

          {/* Specifications */}
          {allSpecs.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
              <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Specifications</p>
              <ul className="space-y-2">
                {allSpecs.map((spec) => (
                  <EditableField key={spec.label} sectionKey="specifications" label={spec.label} value={spec.value} pending={spec.pending} />
                ))}
              </ul>
            </div>
          )}

          {/* Manufacturing Notes */}
          {allNotes.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
              <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Manufacturing Notes</p>
              <ul className="space-y-2">
                {allNotes.map((note) => (
                  <EditableField key={note.label} sectionKey="manufacturingNotes" label={note.label} value={note.value} pending={note.pending} />
                ))}
              </ul>
            </div>
          )}

          {/* Commercial Terms */}
          {allCommercial.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-4">
              <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">Commercial Terms</p>
              <ul className="space-y-2">
                {allCommercial.map((term) => (
                  <EditableField key={term.label} sectionKey="commercialTerms" label={term.label} value={term.value} pending={term.pending} />
                ))}
              </ul>
            </div>
          )}

          {/* Missing fields banner */}
          {missingFields.length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} not found in your documents
                </p>
                <p className="text-xs text-amber-700">
                  {missingFields.join(' · ')}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Click "Refine with AI" to fill these in via a quick chat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={onRefineWithAI}
            className="flex items-center gap-2 px-5 py-2.5 border border-[var(--border)] rounded-xl text-sm font-semibold text-[var(--foreground)] hover:border-primary/40 hover:bg-[var(--secondary)] transition-all"
          >
            <RotateCcw size={14} /> Refine with AI
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-[#2e29c4] active:scale-[0.98] transition-all"
          >
            <CheckCircle size={15} /> Submit RFQ
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2 max-w-3xl mx-auto">Submitting notifies the Proquoment team to match you with verified suppliers</p>
      </div>
    </div>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
export default function NewProductFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [productText, setProductText] = useState('');
  const [rfqMethod, setRfqMethod] = useState<RFQMethod>('scratch');
  const [draftId, setDraftId] = useState<string | undefined>();
  // C3 FIX: capture selected images from ImageSearchStep to pass to BuilderStep
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  // Stable RFQ ID generated once — links reference images to this RFQ before submission
  const [rfqId] = useState(() => `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // ── Upload extraction state ──
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedRfqData, setExtractedRfqData] = useState<Partial<RFQData> | null>(null);
  const [extractedText, setExtractedText] = useState('');
  // ── Isolated product+design query from extraction (for accurate image search) ──
  const [extractionDesignQuery, setExtractionDesignQuery] = useState('');

  // ── Check for draft query param on mount ──
  useEffect(() => {
    const draft = searchParams.get('draft');
    if (draft) {
      setDraftId(draft);
      setStep('builder');
      setProductText('(Resuming draft)');
    }
  }, [searchParams]);

  const productName = deriveProductName(productText);

  const handleChoose = async (method: RFQMethod) => {
    setRfqMethod(method);
    if (method === 'scratch') {
      // Isolate product+design from mixed front-page text before image search
      // (strips location, incoterms, payment, quantity — keeps product+material+color+specs)
      if (productText.trim().length > 30) {
        try {
          const isoRes = await fetch('/api/ai/isolate-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: productText }),
          });
          if (isoRes.ok) {
            const isoData = await isoRes.json();
            if (isoData.designQuery && isoData.designQuery.trim()) {
              setProductText(isoData.designQuery);
            }
          }
        } catch {
          // Fallback: use raw productText — image search still works, just less precise
          console.warn('[NewProductFlow] Product isolation failed, using raw text for image search');
        }
      }
      setStep('image-search');
    } else {
      setStep('upload');
    }
  };

  // Files submitted from UploadStep → go to extraction
  const handleUploadSubmit = (files: File[]) => {
    if (files.length === 0) {
      // No files — skip to builder
      setStep('builder');
      return;
    }
    setUploadedFiles(files);
    setStep('extracting');
  };

  // Extraction complete → convert to legacy format for ReviewStep, then show review
  const handleExtractionComplete = (rfqData: Partial<RFQData>, text: string, designQuery?: string, designAttributes?: string[]) => {
    // C6 FIX: if extraction returns RFQState format (product.name exists but productName doesn't),
    // convert to legacy RFQData shape that ReviewStep expects
    let legacyData: Partial<RFQData> = rfqData;
    if (rfqData && (rfqData as any).product?.name && !rfqData.productName) {
      const state = rfqData as any;
      legacyData = {
        productName: state.product?.name?.value || '',
        category: state.product?.classification?.broad_category || '',
        moq: state.quantity?.value?.value || '',
        description: state.product?.description?.value || '',
        specifications: Object.entries(state.specifications || {}).map(([k, v]: [string, any]) => ({
          label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: v?.value || '',
          pending: !v?.value,
        })),
        manufacturingNotes: Object.entries(state.manufacturing || {}).map(([k, v]: [string, any]) => ({
          label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: v?.value || '',
          pending: !v?.value,
        })),
        commercialTerms: Object.entries(state.commercial || {}).map(([k, v]: [string, any]) => ({
          label: k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: v?.value || '',
          pending: !v?.value,
        })),
        missingFields: [],
      };
    }
    setExtractedRfqData(legacyData);
    setExtractedText(text);
    // Store the isolated product+design query for accurate image search
    if (designQuery) {
      setExtractionDesignQuery(designQuery);
    }

    // Auto-carry buyer's uploaded image files directly as reference images!
    const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (imageFiles.length > 0) {
      Promise.all(
        imageFiles.map(file => new Promise<{ original: string; thumbnail: string; title: string; position: number }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve({
              original: dataUrl,
              thumbnail: dataUrl,
              title: file.name,
              position: 0,
            });
          };
          reader.onerror = () => resolve({ original: '', thumbnail: '', title: file.name, position: 0 });
          reader.readAsDataURL(file);
        }))
      ).then(converted => {
        const validImgs = converted.filter(img => img.original);
        if (validImgs.length > 0) {
          setSelectedImages(validImgs);
        }
      });
    }

    if (!productText || productText === '') {
      setProductText(legacyData.productName || legacyData.description || 'Uploaded RFQ');
    }
    setStep('review');
  };

  // Extraction failed
  const handleExtractionError = (message: string) => {
    toast.error(message, { duration: 6000 });
    setStep('upload'); // go back to upload
  };

  // From ReviewStep: "Submit RFQ" — uses extracted data
  const handleReviewSubmit = async () => {
    if (!extractedRfqData) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const title = extractedRfqData.productName || deriveProductName(productText) || 'New Product';

    // Save to product store
    await saveProduct({
      id: `prod-rfq-${Date.now()}`,
      name: title,
      category: extractedRfqData.category || '',
      description: extractedRfqData.description || '',
      moq: extractedRfqData.moq || '',
      specifications: extractedRfqData.specifications || [],
      manufacturingNotes: extractedRfqData.manufacturingNotes || [],
      status: 'New Update',
      stage: 'Quoting',
      updated: dateStr,
      image: '',
      imageAlt: `${title} product`,
    });

    // Submit to Supabase rfqs table
    try {
      const isDemo = user?.email ? ['demo@proquoment.com', 'buyer@proquoment.com'].includes(user.email) : false;
      const buyerName = isDemo
        ? 'Demo User'
        : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Enterprise Buyer';

      const specsStr = (extractedRfqData.specifications || [])
        .filter((s) => !s.pending)
        .map((s) => `${s.label}: ${s.value}`)
        .join(', ');
      const commercialStr = (extractedRfqData.commercialTerms || [])
        .filter((t) => !t.pending)
        .map((t) => `${t.label}: ${t.value}`)
        .join(' | ');

      await submitRFQ({
        product: title,
        qty: extractedRfqData.moq || 'TBD',
        value: (extractedRfqData.specifications?.find((s) => s.label === 'Target Unit Price')?.value) || 'TBD',
        specs: [specsStr, commercialStr].filter(Boolean).join(' || ') || 'Extracted from uploaded documents.',
        buyer: buyerName,
        description: extractedRfqData.description,
      });
    } catch (err) {
      console.error('[NewProductFlow] RFQ submit failed:', err);
    }

    toast.success('RFQ submitted! Product added to your list.');
    setTimeout(() => router.push('/products-list'), 1000);
  };

  // From ReviewStep: "Refine with AI" — if user already uploaded real images, skip directly to builder!
  const handleRefineWithAI = () => {
    const searchQuery =
      extractionDesignQuery ||
      extractedRfqData?.productName ||
      extractedRfqData?.description ||
      productText;
    if (searchQuery && searchQuery !== productText) {
      setProductText(searchQuery);
    }

    // If buyer uploaded actual photos during extraction, pass them straight to BuilderStep!
    // No need to force them into a generic text-to-image search.
    const hasUploadedImages = uploadedFiles.some(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (hasUploadedImages || selectedImages.length > 0) {
      setStep('builder');
    } else {
      setStep('image-search');
    }
  };

  if (step === 'intro') {
    return (
      <IntroStep
        onNext={(text) => {
          setProductText(text);
          setStep('transition');
        }}
      />
    );
  }
  if (step === 'transition') {
    return <TransitionStep productText={productText} onNext={() => setStep('choose')} />;
  }
  if (step === 'choose') {
    return <ChooseStep onNext={handleChoose} />;
  }
  if (step === 'image-search') {
    return (
      <ImageSearchStep
        productText={productText}
        rfqId={rfqId}
        // C3 FIX: capture selected images instead of ignoring them
        onNext={(imgs) => { setSelectedImages(imgs || []); setStep('builder'); }}
        onSkip={() => setStep('builder')}
      />
    );
  }
  if (step === 'upload') {
    return (
      <UploadStep
        method={rfqMethod}
        onBack={() => setStep('choose')}
        onSkip={() => setStep('builder')}
        onSubmit={handleUploadSubmit}
      />
    );
  }
  if (step === 'extracting') {
    return (
      <ExtractionStep
        files={uploadedFiles}
        method={rfqMethod}
        onComplete={handleExtractionComplete}
        onError={handleExtractionError}
      />
    );
  }
  if (step === 'review') {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{ style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'inherit' } }}
        />
        <ReviewStep
          rfqData={extractedRfqData || {}}
          method={rfqMethod}
          onSubmit={handleReviewSubmit}
          onRefineWithAI={handleRefineWithAI}
          onBack={() => setStep('upload')}
          productText={productText}
        />
      </>
    );
  }
  return (
    <BuilderStep
      productText={productText || extractedText}
      productName={productName}
      draftId={draftId}
      tempRfqId={rfqId}
      // C3 FIX: pass through selected inspiration images
      selectedImages={selectedImages}
      prefilledRfq={extractedRfqData || undefined}
    />
  );
}
