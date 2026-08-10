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

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = 'intro' | 'transition' | 'choose' | 'upload' | 'extracting' | 'review' | 'image-search' | 'builder';
type RFQMethod = 'complete' | 'partial' | 'scratch';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
  options?: string[];
  multiSelect?: boolean; // Issue #8 — multi-select chip support
  isStreaming?: boolean;
  images?: { url: string; title?: string }[];
}

interface RFQData {
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
const CHAT_SYSTEM_PROMPT = `You are a precision procurement RFQ agent for Proquoment, a B2B international sourcing platform. Help the buyer build a complete, manufacturer-ready RFQ through intelligent, focused questions.

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
function trimHistory(history: { role: string; content: string }[]) {
  return history.length > MAX_HISTORY_MESSAGES
    ? history.slice(history.length - MAX_HISTORY_MESSAGES)
    : history;
}

/**
 * Build a compact text summary of all confirmed (non-pending) RFQ fields.
 * Injected into the system prompt so the AI never re-asks answered questions,
 * even if old messages have been trimmed from conversation history.
 */
function buildConfirmedFieldsSummary(rfq: RFQData): string {
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

const JSON_SYSTEM_PROMPT = `You are a data extraction agent. Based on the conversation provided, extract all known product details and return ONLY a valid JSON object. No explanations, no text, no markdown — just the raw JSON object.

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

const EMPTY_RFQ: RFQData = {
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
function extractOptionsFromText(text: string): { cleanText: string; options: string[]; multiSelect: boolean } {
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

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-3 mb-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
          style={{ animationDelay: `${i * 120}ms`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  onOptionClick,
  onCorrect,
  isLoading,
}: {
  msg: Message;
  onOptionClick: (opt: string) => void;
  onCorrect?: (text: string) => void;
  isLoading: boolean;
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
          <div className="flex flex-col items-end gap-2 mb-1">
            {msg.images.map((img, i) => (
              <div
                key={i}
                className="w-16 h-20 rounded-xl overflow-hidden border border-gray-200/90 shadow-sm bg-gray-50 flex-shrink-0"
              >
                <img
                  src={img.url}
                  alt={img.title || `Inspiration ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
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


// ─── RFQ Panel ────────────────────────────────────────────────────────────────
function RFQPanel({
  rfq,
  rfqTitle,
  finalized,
  isLoading,
  onFinalize,
}: {
  rfq: RFQData;
  rfqTitle: string;
  finalized: boolean;
  isLoading: boolean;
  onFinalize: () => void;
}) {
  // Issue #2: filter specs to only relevant fields for this category
  const relevantLabels = rfq.categoryRelevantFields.length > 0
    ? new Set(rfq.categoryRelevantFields)
    : null; // null = show all (no category determined yet)

  const visibleSpecs = relevantLabels
    ? rfq.specifications.filter(s => relevantLabels.has(s.label))
    : rfq.specifications;

  const allNotes = rfq.manufacturingNotes;
  const allCommercial = rfq.commercialTerms || [];

  // Issue #3: compute completion including commercial terms; never go backwards
  const filledSpecs = visibleSpecs.filter((s) => !s.pending).length;
  const filledNotes = allNotes.filter((n) => !n.pending).length;
  const filledCommercial = allCommercial.filter((c) => !c.pending).length;
  const basicFilled =
    (rfq.productName ? 1 : 0) +
    (rfq.category ? 1 : 0) +
    (rfq.intendedUse ? 1 : 0) +
    (rfq.description ? 1 : 0) +
    (rfq.moq ? 1 : 0);

  const totalFields = visibleSpecs.length + allNotes.length + allCommercial.length + 5;
  const rawPct = totalFields > 0 ? Math.round(((filledSpecs + filledNotes + filledCommercial + basicFilled) / totalFields) * 100) : 0;

  // Issue #3: high-water-mark — progress never decreases
  const highWaterRef = React.useRef(0);
  highWaterRef.current = Math.max(rawPct, highWaterRef.current);
  const completionPct = highWaterRef.current;

  // 70% gate removed — buyer can finalize at any completion percentage
  const canFinalize = true;

  const hasBasicInfo =
    rfq.productName || rfq.category || rfq.intendedUse || rfq.description || rfq.moq;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Panel header */}
      <div className="px-7 pt-7 pb-5 border-b border-gray-100">
        <h2 className="text-lg font-bold text-[#0D0D14] leading-snug mb-1">
          {rfqTitle || 'New Product RFQ'}
        </h2>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${completionPct}%`,
                backgroundColor: completionPct >= 70 ? '#16a34a' : '#0D0D14',
              }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${completionPct >= 70 ? 'text-green-600' : 'text-[#0D0D14]'}`}>
            {completionPct}%
          </span>
        </div>

      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7 text-sm">
        {/* Basic info */}
        {hasBasicInfo ? (
          <div className="space-y-2">
            {rfq.productName && <InfoRow label="Product Name" value={rfq.productName} bold />}
            {rfq.category && <InfoRow label="Category" value={rfq.category} />}
            {rfq.intendedUse && <InfoRow label="Intended Use / Function" value={rfq.intendedUse} />}
            {rfq.description && <InfoRow label="Product Description" value={rfq.description} />}
            {rfq.moq && <InfoRow label="MOQ" value={rfq.moq} />}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Product details will appear here as the conversation progresses…
          </p>
        )}

        {/* Specifications — Issue #2: only relevant fields shown */}
        {visibleSpecs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">
              Specifications:
            </p>
            <ul className="space-y-2">
              {visibleSpecs.map((spec, i) => (
                <li key={i} className="flex items-baseline gap-1.5 text-sm leading-snug">
                  <span className="text-gray-400 flex-shrink-0">•</span>
                  {spec.pending ? (
                    <span className="text-gray-400 italic">{spec.label}: (Pending)</span>
                  ) : (
                    <span className="text-[#0D0D14]">
                      <span className="font-semibold">{spec.label}:</span> {spec.value}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manufacturing Notes */}
        <div>
          <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">
            Manufacturing Notes:
          </p>
          <ul className="space-y-2">
            {allNotes.map((note, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-sm leading-snug">
                <span className="text-gray-400 flex-shrink-0">•</span>
                {note.pending ? (
                  <span className="text-gray-400 italic">{note.label}: (Pending)</span>
                ) : (
                  <span className="text-[#0D0D14]">
                    <span className="font-semibold">{note.label}:</span> {note.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Commercial Terms — Issue #5 #6: new section */}
        <div>
          <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">
            Commercial Terms:
          </p>
          <ul className="space-y-2">
            {allCommercial.map((term, i) => (
              <li key={i} className="flex items-baseline gap-1.5 text-sm leading-snug">
                <span className="text-gray-400 flex-shrink-0">•</span>
                {term.pending ? (
                  <span className="text-gray-400 italic">{term.label}: (Pending)</span>
                ) : (
                  <span className="text-[#0D0D14]">
                    <span className="font-semibold">{term.label}:</span> {term.value}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Ambiguities */}
        {rfq.ambiguities.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#0D0D14] uppercase tracking-widest mb-3">
              Ambiguities / Pending Clarifications:
            </p>
            <ul className="space-y-1.5">
              {rfq.ambiguities.map((item, i) => (
                <li key={i} className="flex items-baseline gap-1.5 text-sm text-gray-500">
                  <span className="flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Finalize button */}
      <div className="px-7 py-5 border-t border-gray-100">
        <button
          onClick={onFinalize}
          disabled={finalized || isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0D0D14] text-white rounded-xl text-sm font-semibold hover:bg-[#1a1a26] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {finalized ? (
            <>
              <CheckCircle size={15} /> RFQ Finalized!
            </>
          ) : (
            <>
              <ChevronRight size={15} /> Finalize &amp; Add to Products
            </>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">Adds product to your sourcing list</p>
      </div>
    </div>
  );
}


function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="text-sm leading-snug">
      <span className="font-semibold text-[#0D0D14]">{label}:</span>{' '}
      <span className={bold ? 'text-[#0D0D14] font-medium' : 'text-gray-600'}>{value}</span>
    </div>
  );
}

// ─── Step 4: RFQ Builder (Dual Gemini calls) ──────────────────────────────────
function BuilderStep({
  productText,
  productName,
  draftId: initialDraftId,
  tempRfqId,
  selectedImages = [],
  prefilledRfq,
}: {
  productText: string;
  productName: string;
  draftId?: string;
  tempRfqId?: string;
  selectedImages?: any[];
  /** Pre-extracted RFQ data from uploaded files — merged into initial state */
  prefilledRfq?: Partial<RFQData>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [rfqTitle, setRfqTitle] = useState(productName || 'New Product RFQ');
  // If prefilledRfq provided (from file upload), merge into EMPTY_RFQ so AI only asks about missing fields
  const [rfq, setRfq] = useState<RFQData>(() => {
    if (!prefilledRfq) return { ...EMPTY_RFQ };
    return {
      ...EMPTY_RFQ,
      ...prefilledRfq,
      specifications: prefilledRfq.specifications?.length
        ? prefilledRfq.specifications
        : EMPTY_RFQ.specifications,
      manufacturingNotes: prefilledRfq.manufacturingNotes?.length
        ? prefilledRfq.manufacturingNotes
        : EMPTY_RFQ.manufacturingNotes,
      commercialTerms: prefilledRfq.commercialTerms?.length
        ? prefilledRfq.commercialTerms
        : EMPTY_RFQ.commercialTerms,
      categoryRelevantFields: prefilledRfq.categoryRelevantFields || [],
      ambiguities: prefilledRfq.ambiguities || [],
    };
  });
  const rfqRef = useRef<RFQData>(rfq);
  useEffect(() => { rfqRef.current = rfq; }, [rfq]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const [initialized, setInitialized] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Draft state ──
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const draftSaveCounterRef = useRef(0); // tracks AI responses for auto-save
  const draftRestoredRef = useRef(false);

  // Streaming hook for conversational text only
  const {
    response: streamingResponse,
    isLoading: isStreaming,
    error: streamError,
    sendMessage: sendStreamingMessage,
  } = useChat('AUTO', 'auto', true);

  // On stream error: remove any stuck empty AI bubbles and show toast so user can retry
  useEffect(() => {
    if (streamError) {
      // Remove the stuck streaming bubble (empty text, isStreaming flag still true)
      setMessages((prev) => prev.filter((m) => !(m.role === 'ai' && m.isStreaming && !m.text)));
      const msg = streamError.message || '';
      if (
        msg.includes('503') ||
        msg.toLowerCase().includes('unavailable') ||
        msg.toLowerCase().includes('all ai')
      ) {
        toast.error('All AI providers are currently unavailable. Please try again shortly.', {
          duration: 6000,
        });
      } else {
        toast.error('AI connection interrupted — please send your message again.', {
          duration: 5000,
        });
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

  // When streaming completes: finalize message + update conversation history
  useEffect(() => {
    if (!isStreaming && streamingResponse && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.isStreaming) {
        const { cleanText, options: inlineOptions, multiSelect } = extractOptionsFromText(streamingResponse);

        // Finalize the streaming message with clean text
        // Issue #8: pass multiSelect flag through to message
        const finalMsg: Message = {
          ...last,
          text: cleanText,
          isStreaming: false,
          multiSelect: multiSelect || undefined,
          options: inlineOptions.length > 0 ? inlineOptions : undefined,
        };
        setMessages((prev) => [...prev.slice(0, -1), finalMsg]);

        // Add to conversation history
        const updatedHistory = [...conversationHistory, { role: 'assistant', content: cleanText }];
        setConversationHistory(updatedHistory);

        // ── Auto-save draft every 2 AI responses ──
        draftSaveCounterRef.current += 1;
        if (draftSaveCounterRef.current % 2 === 0 && !finalized) {
          setTimeout(() => triggerDraftSave(), 500);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Second Gemini call: extract structured JSON for RFQ panel (with retry on 429)
  const fireJsonExtractionCall = useCallback(
    async (
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
            ...trimHistory(history).map((h) => ({ role: h.role, content: h.content })),
            {
              role: 'user',
              content: 'Extract the current RFQ data from the conversation above as JSON.',
            },
          ];

          const result = await getChatCompletion('AUTO', 'auto', jsonMessages, {
            temperature: 0.1,
            max_tokens: 2048,
          });

          const rawContent: string = result?.choices?.[0]?.message?.content || '';

          // Parse JSON — strip any accidental markdown fences
          let jsonStr = rawContent.trim();
          jsonStr = jsonStr
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          const parsed = JSON.parse(jsonStr);
          const { options: jsonOptions, ...rfqUpdate } = parsed;

          // Update RFQ panel
          setRfq((prev) => {
            const updated = { ...prev };
            if (rfqUpdate.productName) {
              updated.productName = rfqUpdate.productName;
              setRfqTitle(rfqUpdate.productName);
            }
            if (rfqUpdate.category) updated.category = rfqUpdate.category;
            if (rfqUpdate.intendedUse) updated.intendedUse = rfqUpdate.intendedUse;
            // Issue #7: only update description if new value is substantively longer (prevent regression to raw input)
            if (rfqUpdate.description) {
              const newDesc = rfqUpdate.description;
              const oldDesc = prev.description || '';
              // Accept new description if it's longer or if current is empty/same as raw first message
              if (!oldDesc || newDesc.length >= oldDesc.length) {
                updated.description = newDesc;
              }
            }
            if (rfqUpdate.moq) updated.moq = rfqUpdate.moq;
            // Issue #3: merge specs preserving filled fields (never regress to Pending)
            if (rfqUpdate.specifications?.length) {
              updated.specifications = rfqUpdate.specifications.map((newSpec: any) => {
                const existing = prev.specifications.find(s => s.label === newSpec.label);
                // Keep filled value if new would regress it to Pending
                if (existing && !existing.pending && newSpec.pending) return existing;
                return newSpec;
              });
            }
            if (rfqUpdate.manufacturingNotes?.length) {
              updated.manufacturingNotes = rfqUpdate.manufacturingNotes.map((newNote: any) => {
                const existing = prev.manufacturingNotes.find(n => n.label === newNote.label);
                if (existing && !existing.pending && newNote.pending) return existing;
                return newNote;
              });
            }
            // Issue #5 #6: merge commercial terms
            if (rfqUpdate.commercialTerms?.length) {
              updated.commercialTerms = rfqUpdate.commercialTerms.map((newTerm: any) => {
                const existing = prev.commercialTerms.find(c => c.label === newTerm.label);
                if (existing && !existing.pending && newTerm.pending) return existing;
                return newTerm;
              });
            }
            // Issue #2: update categoryRelevantFields from AI
            if (rfqUpdate.categoryRelevantFields?.length) {
              updated.categoryRelevantFields = rfqUpdate.categoryRelevantFields;
            }
            if (rfqUpdate.ambiguities) updated.ambiguities = rfqUpdate.ambiguities;
            return updated;
          });

          // If JSON call returned options and inline didn't have any, update the message
          const finalOptions = inlineOptions.length > 0 ? inlineOptions : jsonOptions || [];
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
          const isRateLimit =
            errMsg.includes('429') ||
            errMsg.toLowerCase().includes('rate limit') ||
            errMsg.toLowerCase().includes('quota');

          if (isRateLimit && attempt < MAX_RETRIES - 1) {
            // Will retry after backoff delay
            continue;
          }
          // Final attempt failed or non-rate-limit error — fail silently (chat still works)
        }
      }
    },
    []
  );

  // ── Draft save function ──
  const triggerDraftSave = useCallback(async () => {
    if (finalized || draftSaving) return;
    setDraftSaving(true);
    setDraftSaved(false);
    try {
      // Compute completion pct inline
      const filledSpecs = rfq.specifications.filter(s => !s.pending).length;
      const filledNotes = rfq.manufacturingNotes.filter(n => !n.pending).length;
      const filledCommercial = (rfq.commercialTerms || []).filter(c => !c.pending).length;
      const basicFilled = (rfq.productName ? 1 : 0) + (rfq.category ? 1 : 0) + (rfq.intendedUse ? 1 : 0) + (rfq.description ? 1 : 0) + (rfq.moq ? 1 : 0);
      const totalFields = rfq.specifications.length + rfq.manufacturingNotes.length + (rfq.commercialTerms || []).length + 5;
      const pct = totalFields > 0 ? Math.round(((filledSpecs + filledNotes + filledCommercial + basicFilled) / totalFields) * 100) : 0;

      const savedId = await saveDraftRFQ({
        id: draftId,
        title: rfqTitle || deriveProductName(productText) || 'Untitled RFQ',
        productText,
        rfqData: rfq,
        conversationHistory,
        messages: messages.filter(m => !m.isStreaming), // don't save streaming state
        completionPct: pct,
      });
      setDraftId(savedId);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err) {
      console.error('Draft save failed:', err);
    } finally {
      setDraftSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, rfqTitle, productText, rfq, conversationHistory, messages, finalized, draftSaving]);

  // ── Auto-save on page leave ──
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!finalized && messages.length > 1) {
        // Best-effort save via sendBeacon isn't practical for Supabase, but we
        // trigger save on visibilitychange which fires before unload
        triggerDraftSave();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !finalized && messages.length > 1) {
        triggerDraftSave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerDraftSave, finalized, messages.length]);

  // ── Restore draft on mount ──
  useEffect(() => {
    if (!initialDraftId || draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    (async () => {
      const draft = await fetchDraftRFQ(initialDraftId);
      if (!draft) {
        toast.error('Draft not found');
        return;
      }
      // Restore state
      setRfqTitle(draft.title);
      setRfq(draft.rfqData as RFQData);
      setConversationHistory(draft.conversationHistory);
      setMessages(draft.messages as Message[]);
      setDraftId(draft.id);
      setInitialized(true); // prevent re-initialization
      toast.success('Draft restored — continue your RFQ');
    })();
  }, [initialDraftId]);

  // Initialize conversation
  const initializeConversation = useCallback(() => {
    if (initialized || !productText) return;
    setInitialized(true);

    const initialMsgText = selectedImages.length > 0
      ? `Here are my inspiration images for ${productText}`
      : productText;

    const imgList = selectedImages.map((img: any) => ({
      url: img.thumbnail || img.original,
      title: img.title || '',
    }));

    // If prefilled data exists, tell the AI what was already extracted from uploaded files
    const prefilledContext = prefilledRfq
      ? `\n\nIMPORTANT: The buyer has already uploaded documents. The following fields were AUTOMATICALLY EXTRACTED from those files and are pre-confirmed. DO NOT re-ask about these fields:\n${buildConfirmedFieldsSummary(rfqRef.current)}\n\nOnly ask about the fields listed in missingFields or any other fields still pending.`
      : '';

    const userContent = selectedImages.length > 0
      ? `Here are my inspiration images for ${productText}.\n\nInspiration images selected by buyer:\n${selectedImages.map((img: any, i: number) => `- Image ${i + 1}: ${img.title || 'Product sample'}`).join('\n')}\n\nPlease acknowledge these inspiration images in your first response.`
      : prefilledRfq
        ? `I have uploaded documents for my RFQ. Key details have been extracted. Please help me fill in the remaining missing fields: ${(prefilledRfq.missingFields || []).join(', ') || 'Please review and ask about any unclear specifications.'}`
        : `I want to source the following product: ${productText}`;

    const initialHistory = [{ role: 'user', content: userContent, images: imgList.length > 0 ? imgList : undefined }];
    setConversationHistory(initialHistory);

    setMessages([
      {
        id: 'user-init',
        role: 'user',
        text: initialMsgText,
        images: imgList.length > 0 ? imgList : undefined,
      },
    ]);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    const confirmedSummary = buildConfirmedFieldsSummary(rfqRef.current);
    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT + confirmedSummary + prefilledContext }, ...trimHistory(initialHistory)],
      { temperature: 0.7, max_tokens: 1024 }
    );
  }, [initialized, productText, selectedImages, sendStreamingMessage, prefilledRfq]); // rfqRef is a ref, no dep needed

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

    // Fire JSON extraction immediately in parallel — don't wait for AI chat to finish.
    // User's answer already contains the data we need to update the RFQ panel live.
    const placeholderMsg: Message = { id: `ai-json-${Date.now()}`, role: 'ai', text: '' };
    fireJsonExtractionCall(newHistory, placeholderMsg, []);

    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'ai', text: '', isStreaming: true }]);

    const confirmedSummary = buildConfirmedFieldsSummary(rfqRef.current);
    sendStreamingMessage(
      [{ role: 'system', content: CHAT_SYSTEM_PROMPT + confirmedSummary }, ...trimHistory(newHistory)],
      { temperature: 0.7, max_tokens: 1024 }
    );
  };

  const handleFinalize = async () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = rfqTitle || rfq.productName || deriveProductName(productText);

    await saveProduct({
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

    try {
      const isDemo = user?.email ? ['demo@proquoment.com', 'buyer@proquoment.com'].includes(user.email) : false;
      const buyerName = isDemo
        ? 'Demo User'
        : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Enterprise Buyer';

      // Issue #6: include commercial terms in submitted specs
      const commercialSpecStr = (rfq.commercialTerms || [])
        .filter(t => !t.pending)
        .map(t => `${t.label}: ${t.value}`)
        .join(' | ');
      const productSpecStr = rfq.specifications
        .filter(s => !s.pending)
        .map(s => `${s.label}: ${s.value}`)
        .join(', ');
      const specsStr = [productSpecStr, commercialSpecStr].filter(Boolean).join(' || ');

      const realId = await submitRFQ({
        product: title,
        qty: rfq.moq || 'TBD',
        value: 'TBD',
        specs: specsStr || rfq.specifications.map((s) => `${s.label}: ${s.value}`).join(', '),
        buyer: buyerName,
        description: rfq.description || undefined,
        aiChat: conversationHistory,
      });
      // Relink reference images: temp rfqId → real RFQ id
      if (tempRfqId && realId) {
        try {
          await fetch('/api/rfq-images/relink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempId: tempRfqId, realId }),
          });
        } catch (e) {
          console.warn('Reference image relink failed (non-blocking):', e);
        }
      }
    } catch (err) {
      console.error('Failed to submit RFQ to Admin', err);
    }


    // Delete draft on finalize
    if (draftId) {
      try {
        await deleteDraftRFQ(draftId);
      } catch {
        // Non-critical — draft cleanup failure shouldn't block finalization
      }
    }

    setFinalized(true);
    toast.success('RFQ finalized! Product added to your list.');
    setTimeout(() => router.push('/products-list'), 1200);
  };

  // Issue #10: pre-fill input with old answer so user can correct it
  const handleCorrect = useCallback((oldText: string) => {
    setInputValue(oldText);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const isDisabled = isStreaming || isProcessing;

  return (
    <div className="relative h-screen bg-white flex flex-col overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{ style: { fontSize: '13px', borderRadius: '10px', fontFamily: 'inherit' } }}
      />

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-100 bg-white z-10 flex-shrink-0">
        <Link
          href="/products-list"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#0D0D14] transition-colors whitespace-nowrap"
        >
          <span className="text-base leading-none">‹</span>{' '}
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={rfqTitle}
            onChange={(e) => setRfqTitle(e.target.value)}
            className="w-full text-sm font-semibold text-[#0D0D14] bg-transparent outline-none border-b border-primary pb-0.5 truncate placeholder:text-gray-300"
            placeholder="Product RFQ title…"
          />
        </div>
        {/* Save Draft button */}
        {!finalized && (
          <button
            onClick={() => triggerDraftSave()}
            disabled={draftSaving || messages.length < 2}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
              draftSaved
                ? 'bg-green-50 text-green-600 border border-green-200'
                : draftSaving
                  ? 'bg-gray-50 text-gray-400 border border-gray-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Save as draft"
          >
            {draftSaved ? (
              <><CheckCircle size={12} /> Saved</>
            ) : draftSaving ? (
              <><Loader2 size={12} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={12} /> Save Draft</>
            )}
          </button>
        )}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-[#0D0D14] hover:bg-gray-50 transition-colors"
          title={panelOpen ? 'Hide RFQ panel' : 'Show RFQ panel'}
        >
          {panelOpen ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Chat (always full width on mobile) ── */}
        <div
          className={`flex flex-col transition-all duration-300 ${panelOpen ? 'hidden md:flex md:w-[56%]' : 'w-full'} w-full`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onOptionClick={handleSend}
                  onCorrect={msg.role === 'user' ? handleCorrect : undefined}
                  isLoading={isDisabled}
                />
              ))}
              {isDisabled && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ── Input area ── */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white">
            <div className="max-w-2xl mx-auto px-3 md:px-8 py-3 md:py-4">
              <div className="border border-gray-200 rounded-2xl bg-white focus-within:border-gray-400 transition-colors duration-150 overflow-hidden">
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
                  placeholder="Type your answer or add more details…"
                  rows={2}
                  disabled={isDisabled}
                  className="w-full px-4 pt-3.5 pb-1 text-sm text-[#0D0D14] placeholder:text-gray-300 outline-none resize-none bg-transparent disabled:opacity-50 leading-relaxed"
                />
                <div className="flex items-center justify-between px-4 pb-3 pt-1">
                  <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0D0D14] transition-colors">
                    <Paperclip size={12} /> <span className="hidden sm:inline">Add references</span>
                  </button>
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={!inputValue.trim() || isDisabled}
                    className="w-7 h-7 rounded-full bg-[#0D0D14] text-white flex items-center justify-center transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#1a1a26] active:scale-95 flex-shrink-0"
                  >
                    {isDisabled ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ArrowUp size={13} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: RFQ panel ── */}
        {panelOpen && (
          <div className="flex-1 overflow-hidden border-l border-gray-100 flex flex-col">
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
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function deriveProductName(text: string): string {
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
  { id: '3', label: 'Running AI analysis', detail: 'Recognizing product fields with OpenRouter' },
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
  onComplete: (rfqData: Partial<RFQData>, extractedText: string) => void;
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
        onComplete(data.rfqData as Partial<RFQData>, data.extractedText || '');
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
  // Stable RFQ ID generated once — links reference images to this RFQ before submission
  const [rfqId] = useState(() => `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // ── Upload extraction state ──
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [extractedRfqData, setExtractedRfqData] = useState<Partial<RFQData> | null>(null);
  const [extractedText, setExtractedText] = useState('');

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

  const handleChoose = (method: RFQMethod) => {
    setRfqMethod(method);
    if (method === 'scratch') {
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

  // Extraction complete → show review
  const handleExtractionComplete = (rfqData: Partial<RFQData>, text: string) => {
    setExtractedRfqData(rfqData);
    setExtractedText(text);
    // Use extracted product name as productText if we don't have one yet
    if (!productText || productText === '') {
      setProductText(rfqData.productName || rfqData.description || 'Uploaded RFQ');
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

  // From ReviewStep: "Refine with AI" — set exact product name from extracted RFQ, then image-search → builder
  const handleRefineWithAI = () => {
    // Prioritise the specific extracted product name over any generic intro text
    const extractedName =
      extractedRfqData?.productName ||
      extractedRfqData?.description ||
      productText;
    if (extractedName && extractedName !== productText) {
      setProductText(extractedName);
    }
    setStep('image-search');
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
        onNext={() => setStep('builder')}
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
      prefilledRfq={extractedRfqData || undefined}
    />
  );
}
