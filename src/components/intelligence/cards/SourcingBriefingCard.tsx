'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Globe,
  ShieldCheck,
  DollarSign,
  Package,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Star,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  ShieldAlert,
  HelpCircle,
  Edit3,
  RotateCcw,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  FileCheck,
  Sparkles,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';

export interface CustomsDoc {
  document: string;
  required: boolean;
  purpose: string;
}

export interface QualityProtocol {
  stage: string;
  protocol: string;
  standard: string;
}

export interface RecommendedOrigin {
  rank: number;
  country: string;
  advantage: string;
  effectiveDuty: string;
  leadTimeDays: string;
}

export interface ComplianceItem {
  item: string;
  required: boolean;
  status: string;
  priority: string;
}

export interface SourcingBriefingData {
  productProfile: {
    name: string;
    category: string;
    hsCode: string;
    materialGrade?: string | null;
    certifications: string[];
    packaging?: string | null;
    dimensions?: string | null;
    orderQuantity: string;
  };
  marketSnapshot: {
    destinationCountry: string;
    annualImportVolumeMT: number;
    annualImportVolumeDisplay?: string;
    annualImportValueUSD: number;
    growthRateYoY: number;
    majorOrigins: Array<{ countryName: string; sharePercent: number }>;
  };
  recommendedOrigins: RecommendedOrigin[];
  complianceChecklist: ComplianceItem[];
  customsPaperwork?: CustomsDoc[];
  qualityProtocols?: QualityProtocol[];
  historicalPriceRef?: {
    low: number;
    high: number;
    unit: string;
    basis: string;
    notice: string;
  } | null;
  landedCostTable?: {
    basePriceUSD: number;
    freightUSD: number;
    dutyUSD: number;
    dutyLabel?: string;
    vatUSD: number;
    totalLandedPerUnitUSD: number;
    costDeltaPercent: number;
    containerType: string;
    transitDays: string;
    basis: string;
  } | null;
  sourcingScore: number;
  rfqReadyScore: number;
  nextSteps: string[];
  buyerTimeline?: string | null;
  buyerBudget?: string | null;
  buyerNotes?: string;
  customizedByBuyer?: boolean;
  lastCustomizedAt?: string | null;
}

interface SourcingBriefingCardProps {
  data: SourcingBriefingData;
  onCreateRFQ?: (customBrief?: SourcingBriefingData) => void;
  onUpdateBriefing?: (updatedData: SourcingBriefingData) => void;
  onViewEvidence?: (metric: string) => void;
}

function formatCurrency(amount: number | undefined | null, decimals = 2): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  const dec = amount > 0 && amount < 10 ? 2 : decimals;
  return (
    '$' +
    Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    })
  );
}

function formatCompactUSD(amount: number | undefined | null): string {
  if (!amount || isNaN(amount)) return '$0.0M USD';
  if (amount >= 1e6) {
    return '$' + (amount / 1e6).toFixed(1) + 'M USD';
  }
  if (amount >= 1e3) {
    return '$' + (amount / 1e3).toFixed(1) + 'k USD';
  }
  return '$' + Number(amount).toLocaleString('en-US') + ' USD';
}

export const SourcingBriefingCard: React.FC<SourcingBriefingCardProps> = ({
  data: initialData,
  onCreateRFQ,
  onUpdateBriefing,
  onViewEvidence,
}) => {
  // Master working state for the briefing
  const [brief, setBrief] = useState<SourcingBriefingData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Synchronize when initialData changes if user hasn't modified
  useEffect(() => {
    if (!brief.customizedByBuyer) {
      setBrief(initialData);
    }
  }, [initialData]);

  // Collapsible section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    market: true,
    origins: true,
    compliance: true,
    price: true,
    landed: true,
    next: true,
  });

  const toggle = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Draft state for modal editing
  const [editTab, setEditTab] = useState<'specs' | 'origin' | 'cost' | 'compliance' | 'notes'>('specs');
  const [draftProduct, setDraftProduct] = useState(brief.productProfile?.name || '');
  const [draftCategory, setDraftCategory] = useState(brief.productProfile?.category || '');
  const [draftHsCode, setDraftHsCode] = useState(brief.productProfile?.hsCode || '');
  const [draftQuantity, setDraftQuantity] = useState(brief.productProfile?.orderQuantity || '');
  const [draftMaterial, setDraftMaterial] = useState(brief.productProfile?.materialGrade || '');
  const [draftDimensions, setDraftDimensions] = useState(brief.productProfile?.dimensions || '');
  const [draftPackaging, setDraftPackaging] = useState(brief.productProfile?.packaging || '');

  // Origin draft
  const [draftSelectedOrigin, setDraftSelectedOrigin] = useState(
    brief.recommendedOrigins?.[0]?.country || 'China'
  );

  // Pricing & Landed Cost draft
  const [draftBasePrice, setDraftBasePrice] = useState(
    brief.landedCostTable?.basePriceUSD || 0
  );
  const [draftFreight, setDraftFreight] = useState(
    brief.landedCostTable?.freightUSD || 0
  );
  const [draftDutyPercent, setDraftDutyPercent] = useState(() => {
    const defaultDuty = brief.recommendedOrigins?.[0]?.effectiveDuty || '3.4%';
    const match = defaultDuty.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : 0;
  });
  const [draftVatUSD, setDraftVatUSD] = useState(
    brief.landedCostTable?.vatUSD || 0
  );

  // Compliance & Customs draft
  const [draftCerts, setDraftCerts] = useState<ComplianceItem[]>(
    brief.complianceChecklist || []
  );
  const [newCertInput, setNewCertInput] = useState('');

  const [draftCustomsDocs, setDraftCustomsDocs] = useState<CustomsDoc[]>(
    brief.customsPaperwork || [
      {
        document: 'Commercial Invoice & Itemized Packing List',
        required: true,
        purpose: 'Customs valuation and cargo itemization',
      },
      {
        document: 'Bill of Lading (Clean On Board Master B/L)',
        required: true,
        purpose: 'Title transfer and port clearance',
      },
      {
        document: 'Certificate of Origin (Form E / Form AI / USMCA)',
        required: true,
        purpose: 'Preferential tariff rate qualification',
      },
      {
        document: 'Import Customs Declaration (PIB / Form 7501)',
        required: true,
        purpose: 'Local customs filing at discharge port',
      },
    ]
  );
  const [newCustomsDocInput, setNewCustomsDocInput] = useState('');

  // Sourcing Notes draft
  const [draftNotes, setDraftNotes] = useState(brief.buyerNotes || '');

  // Toggle direct in-card editing handler
  const handleToggleEdit = () => {
    if (!isEditing) {
      setDraftProduct(brief.productProfile?.name || '');
      setDraftCategory(brief.productProfile?.category || '');
      setDraftHsCode(brief.productProfile?.hsCode || '');
      setDraftQuantity(brief.productProfile?.orderQuantity || '');
      setDraftMaterial(brief.productProfile?.materialGrade || '');
      setDraftDimensions(brief.productProfile?.dimensions || '');
      setDraftPackaging(brief.productProfile?.packaging || '');

      setDraftSelectedOrigin(brief.recommendedOrigins?.[0]?.country || 'China');

      if (brief.landedCostTable) {
        setDraftBasePrice(brief.landedCostTable.basePriceUSD);
        setDraftFreight(brief.landedCostTable.freightUSD);
        const match = (brief.recommendedOrigins?.[0]?.effectiveDuty || '').match(/([\d.]+)%/);
        setDraftDutyPercent(match ? parseFloat(match[1]) : 0);
        setDraftVatUSD(brief.landedCostTable.vatUSD);
      }

      setDraftCerts([...(brief.complianceChecklist || [])]);
      if (brief.customsPaperwork) {
        setDraftCustomsDocs([...brief.customsPaperwork]);
      }
      setDraftNotes(brief.buyerNotes || '');
      setIsEditing(true);

      setTimeout(() => {
        inlineEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Live recalculation of landed cost inside editor
  const calcCalculatedDutyUSD = Number(((draftBasePrice * draftDutyPercent) / 100).toFixed(2));
  const calcTotalLanded = Number((draftBasePrice + draftFreight + calcCalculatedDutyUSD + draftVatUSD).toFixed(2));
  const calcDeltaPct = draftBasePrice > 0
    ? Number((((calcTotalLanded - draftBasePrice) / draftBasePrice) * 100).toFixed(1))
    : 0;

  // Apply Changes Handler
  const handleApplyChanges = () => {
    // Re-rank origins so the selected one is #1
    const updatedOrigins = [...(brief.recommendedOrigins || [])];
    const originIdx = updatedOrigins.findIndex(
      (o) => o.country.toLowerCase() === draftSelectedOrigin.toLowerCase()
    );
    if (originIdx > 0) {
      const [chosen] = updatedOrigins.splice(originIdx, 1);
      chosen.rank = 1;
      updatedOrigins.unshift(chosen);
      updatedOrigins.forEach((o, i) => (o.rank = i + 1));
    } else if (originIdx === -1) {
      updatedOrigins.unshift({
        rank: 1,
        country: draftSelectedOrigin,
        advantage: 'Buyer-specified manufacturing origin corridor',
        effectiveDuty: `${draftDutyPercent}%`,
        leadTimeDays: '18 - 28 days',
      });
      updatedOrigins.forEach((o, i) => (o.rank = i + 1));
    }

    const updatedLandedTable = brief.landedCostTable
      ? {
          ...brief.landedCostTable,
          basePriceUSD: draftBasePrice,
          freightUSD: draftFreight,
          dutyUSD: calcCalculatedDutyUSD,
          dutyLabel: `${draftDutyPercent}% (${draftSelectedOrigin})`,
          vatUSD: draftVatUSD,
          totalLandedPerUnitUSD: calcTotalLanded,
          costDeltaPercent: calcDeltaPct,
        }
      : null;

    const updatedBrief: SourcingBriefingData = {
      ...brief,
      productProfile: {
        ...brief.productProfile,
        name: draftProduct,
        category: draftCategory,
        hsCode: draftHsCode,
        orderQuantity: draftQuantity,
        materialGrade: draftMaterial || null,
        dimensions: draftDimensions || null,
        packaging: draftPackaging || null,
      },
      recommendedOrigins: updatedOrigins,
      complianceChecklist: draftCerts,
      customsPaperwork: draftCustomsDocs,
      landedCostTable: updatedLandedTable,
      buyerNotes: draftNotes,
      customizedByBuyer: true,
      lastCustomizedAt: new Date().toISOString(),
    };

    setBrief(updatedBrief);
    setIsEditing(false);
    onUpdateBriefing?.(updatedBrief);
  };

  // Reset to Baseline Handler
  const handleResetBaseline = () => {
    setBrief({
      ...initialData,
      customizedByBuyer: false,
      lastCustomizedAt: null,
      buyerNotes: '',
    });
    onUpdateBriefing?.({
      ...initialData,
      customizedByBuyer: false,
      lastCustomizedAt: null,
    });
  };

  // Copy Briefing Summary to Clipboard
  const handleCopyBriefing = () => {
    const summaryText = `
=== PROQUOMENT EXECUTIVE SOURCING BRIEFING ===
Product: ${brief.productProfile?.name}
HS Code: ${brief.productProfile?.hsCode} | Category: ${brief.productProfile?.category}
Order Quantity: ${brief.productProfile?.orderQuantity}
Material Grade: ${brief.productProfile?.materialGrade || 'Standard Grade'}
Packaging: ${brief.productProfile?.packaging || 'Export Standard'}

Destination: ${brief.marketSnapshot?.destinationCountry}
Top Origin: ${brief.recommendedOrigins?.[0]?.country || 'N/A'} (${brief.recommendedOrigins?.[0]?.effectiveDuty || 'N/A'})
Estimated Transit: ${brief.recommendedOrigins?.[0]?.leadTimeDays || 'N/A'}

Cost Breakdown (per unit):
- Base FOB: ${formatCurrency(brief.landedCostTable?.basePriceUSD)}
- Ocean/Air Freight: ${formatCurrency(brief.landedCostTable?.freightUSD)}
- Customs Duty: ${formatCurrency(brief.landedCostTable?.dutyUSD)} (${brief.landedCostTable?.dutyLabel || ''})
- Total Landed Cost: ${formatCurrency(brief.landedCostTable?.totalLandedPerUnitUSD)} USD

Mandatory Certificates:
${(brief.complianceChecklist || []).map((c) => `- [${c.priority.toUpperCase()}] ${c.item}`).join('\n')}

Customs Clearance Documents:
${(brief.customsPaperwork || []).map((d) => `- ${d.document}: ${d.purpose}`).join('\n')}

${brief.buyerNotes ? `Buyer Sourcing Notes:\n${brief.buyerNotes}` : ''}
=============================================
`.trim();

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  // Launch RFQ Handler
  const handleLaunchRFQ = () => {
    if (onCreateRFQ) {
      onCreateRFQ(brief);
    }
  };

  const {
    productProfile = {} as any,
    marketSnapshot = {} as any,
    recommendedOrigins = [],
    complianceChecklist = [],
    customsPaperwork = [],
    qualityProtocols = [],
    historicalPriceRef,
    landedCostTable,
    sourcingScore = 85,
    rfqReadyScore = 90,
    nextSteps = [],
    customizedByBuyer,
    lastCustomizedAt,
    buyerNotes,
  } = brief;

  const scoreBadgeBg =
    sourcingScore >= 80
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
      : sourcingScore >= 60
      ? 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans">
      {/* ── Executive Briefing Banner ── */}
      <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-gradient-to-b from-zinc-50/80 to-white dark:from-zinc-900/90 dark:to-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50">
              Executive Sourcing Briefing
            </span>

            {customizedByBuyer ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Customized by Buyer</span>
              </span>
            ) : (
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                Verified Institutional Customs & Trade Data
              </span>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-white capitalize">
            {productProfile.name} <span className="text-zinc-400 dark:text-zinc-500 font-normal">→</span>{' '}
            {marketSnapshot.destinationCountry}
          </h3>

          <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
            <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/60 dark:border-zinc-700/60">
              HS {productProfile.hsCode}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="font-medium">
              Order Volume:{' '}
              <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                {productProfile.orderQuantity}
              </strong>
            </span>
            {productProfile.category && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-zinc-500">{productProfile.category}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls & Sourcing Score */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto flex-wrap">
          {/* Edit Briefing Trigger */}
          <button
            type="button"
            onClick={handleToggleEdit}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-2xs transition-all cursor-pointer ${
              isEditing
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/70 text-zinc-800 dark:text-zinc-200 border-zinc-200/90 dark:border-zinc-700'
            }`}
            title={isEditing ? 'Close inline briefing editor' : 'Edit and customize briefing parameters directly in card'}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{isEditing ? 'Close Editor' : 'Edit Briefing'}</span>
          </button>

          {/* Copy Briefing Trigger */}
          <button
            type="button"
            onClick={handleCopyBriefing}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs transition-all cursor-pointer"
            title="Copy brief summary"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Reset Baseline Trigger if edited */}
          {customizedByBuyer && (
            <button
              type="button"
              onClick={handleResetBaseline}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Reset changes back to AI baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Sourcing Score Widget */}
          <div
            className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border ${scoreBadgeBg} shadow-2xs shrink-0`}
          >
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                Sourcing Score
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none">
                  {sourcingScore}
                </span>
                <span className="text-[11px] font-medium opacity-60">/ 100</span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/80 dark:bg-zinc-800/80 flex items-center justify-center text-amber-500 shadow-2xs shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Inline Direct Briefing Editor Workbench ── */}
      {isEditing && (
        <div
          ref={inlineEditorRef}
          className="border-b border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 via-white to-zinc-50/40 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900/80 p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Editor Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200/70 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Direct Briefing Editor
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Inline Mode
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Update specifications, origins, landed cost models, and requirements directly in this brief card
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyChanges}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Briefing</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 py-3 border-b border-zinc-200/60 dark:border-zinc-800 text-xs overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setEditTab('specs')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                editTab === 'specs'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              1. Specifications
            </button>
            <button
              type="button"
              onClick={() => setEditTab('origin')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                editTab === 'origin'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              2. Origin & Corridor
            </button>
            <button
              type="button"
              onClick={() => setEditTab('cost')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                editTab === 'cost'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              3. Pricing & Landed Cost
            </button>
            <button
              type="button"
              onClick={() => setEditTab('compliance')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                editTab === 'compliance'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              4. Customs & Certs
            </button>
            <button
              type="button"
              onClick={() => setEditTab('notes')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                editTab === 'notes'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-zinc-200/80 dark:border-zinc-700'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              5. Supplier Directives
            </button>
          </div>

          {/* Form Content */}
          <div className="pt-4 pb-2 space-y-4 text-xs">
            {/* TAB 1: Specs */}
            {editTab === 'specs' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Product Title
                    </label>
                    <input
                      type="text"
                      value={draftProduct}
                      onChange={(e) => setDraftProduct(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      HS Tariff Code
                    </label>
                    <input
                      type="text"
                      value={draftHsCode}
                      onChange={(e) => setDraftHsCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Category Classification
                    </label>
                    <input
                      type="text"
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Target Order Quantity
                    </label>
                    <input
                      type="text"
                      value={draftQuantity}
                      onChange={(e) => setDraftQuantity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Material Specification & Grade
                  </label>
                  <input
                    type="text"
                    value={draftMaterial}
                    onChange={(e) => setDraftMaterial(e.target.value)}
                    placeholder="e.g. Food Grade 99.5% Purity / Optical TPU"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Packaging Requirements
                    </label>
                    <input
                      type="text"
                      value={draftPackaging}
                      onChange={(e) => setDraftPackaging(e.target.value)}
                      placeholder="e.g. 25kg Poly Bags in Palletized Shrinkwrap"
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Dimensions / Tolerances
                    </label>
                    <input
                      type="text"
                      value={draftDimensions}
                      onChange={(e) => setDraftDimensions(e.target.value)}
                      placeholder="e.g. 30cm Sitting / 1:1 CNC Tolerance"
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Origin & Logistics */}
            {editTab === 'origin' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Target Sourcing Origin Country
                  </label>
                  <select
                    value={draftSelectedOrigin}
                    onChange={(e) => setDraftSelectedOrigin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    {recommendedOrigins.map((o) => (
                      <option key={o.country} value={o.country}>
                        {o.country} (Rank #{o.rank} - {o.effectiveDuty} duty, {o.leadTimeDays})
                      </option>
                    ))}
                    {!recommendedOrigins.some((o) => o.country.toLowerCase() === 'india') && (
                      <option value="India">India (Alternative Industrial Hub)</option>
                    )}
                    {!recommendedOrigins.some((o) => o.country.toLowerCase() === 'china') && (
                      <option value="China">China (Global Tooling & Manufacturing Epicenter)</option>
                    )}
                    {!recommendedOrigins.some((o) => o.country.toLowerCase() === 'vietnam') && (
                      <option value="Vietnam">Vietnam (ASEAN Regional Hub)</option>
                    )}
                    {!recommendedOrigins.some((o) => o.country.toLowerCase() === 'mexico') && (
                      <option value="Mexico">Mexico (Nearshoring Corridor)</option>
                    )}
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    Origin Trade-off Summary
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Switching your primary origin updates the baseline bilateral tariff calculations,
                    freight corridor transit benchmarks, and supplier filtering in the RFQ.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: Cost & Landed Pricing */}
            {editTab === 'cost' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Target Base FOB Price ($/unit)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={draftBasePrice}
                      onChange={(e) => setDraftBasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Freight Allocation ($/unit)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={draftFreight}
                      onChange={(e) => setDraftFreight(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Estimated Duty Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={draftDutyPercent}
                      onChange={(e) => setDraftDutyPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Local Handling / Port Surtax ($/unit)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={draftVatUSD}
                      onChange={(e) => setDraftVatUSD(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Live Recalculation Preview Banner */}
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/80 border border-indigo-200/80 dark:border-indigo-900/60 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                      Live Calculated Landed Cost / Unit:
                    </span>
                    <span className="text-base font-bold tabular-nums tracking-tight text-indigo-700 dark:text-indigo-400">
                      {formatCurrency(calcTotalLanded)} USD
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-indigo-800 dark:text-indigo-300 mt-1">
                    <span>Landed vs FOB Delta:</span>
                    <span className="tabular-nums font-semibold tracking-tight">
                      +{calcDeltaPct}% (+{formatCurrency(calcCalculatedDutyUSD)} duty)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Compliance & Customs */}
            {editTab === 'compliance' && (
              <div className="space-y-4">
                {/* Regulatory Certificates */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Required Compliance Standards & Testing
                  </label>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {draftCerts.map((cert, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60"
                      >
                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                          {cert.item}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftCerts(draftCerts.filter((_, i) => i !== idx))
                          }
                          className="text-zinc-400 hover:text-rose-600 p-1 transition cursor-pointer"
                          title="Remove certification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Add custom certificate (e.g. SGS AQL 2.5 FRI, RoHS 2.0)"
                      value={newCertInput}
                      onChange={(e) => setNewCertInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCertInput.trim()) {
                          setDraftCerts([
                            ...draftCerts,
                            {
                              item: newCertInput.trim(),
                              required: true,
                              status: 'pending',
                              priority: 'critical',
                            },
                          ]);
                          setNewCertInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1 hover:bg-indigo-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Customs Paperwork */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Customs Clearance Paperwork Requirements
                  </label>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {draftCustomsDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60"
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                            {doc.document}
                          </p>
                          <p className="text-[10px] text-zinc-400">{doc.purpose}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftCustomsDocs(
                              draftCustomsDocs.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-zinc-400 hover:text-rose-600 p-1 transition cursor-pointer"
                          title="Remove document requirement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Add customs document (e.g. Fumigation Certificate, Mill Test)"
                      value={newCustomsDocInput}
                      onChange={(e) => setNewCustomsDocInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCustomsDocInput.trim()) {
                          setDraftCustomsDocs([
                            ...draftCustomsDocs,
                            {
                              document: newCustomsDocInput.trim(),
                              required: true,
                              purpose: 'Customs compliance verification',
                            },
                          ]);
                          setNewCustomsDocInput('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs flex items-center gap-1 hover:bg-indigo-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: Supplier Notes */}
            {editTab === 'notes' && (
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Special Directives & Supplier Instructions
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
                  Enter any private-label instructions, target sample timeline, payment terms, or
                  factory inspection requirements to include directly into your RFQ.
                </p>
                <textarea
                  rows={6}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="e.g. Must support customized packaging with buyer logo. Pre-production sample required within 10 days. Payment terms: 30% advance, 70% against BL copy. All factory audits must meet AQL 2.5 FRI inspection."
                  className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Bottom Action Footer for Inline Editor */}
          <div className="pt-4 mt-3 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Saved modifications immediately update briefing parameters below.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyChanges}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Briefing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Collapsible Sections ── */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {/* 1. Market Snapshot */}
        <div>
          <button
            type="button"
            onClick={() => toggle('market')}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                1. Market Demand & Trade Corridors
              </span>
            </div>
            {openSections['market'] ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {openSections['market'] && (
            <div className="px-5 pb-5 pt-1 bg-zinc-50/30 dark:bg-zinc-900/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-3.5 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Annual Volume
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                    {marketSnapshot.annualImportVolumeDisplay ||
                      `${Number(marketSnapshot.annualImportVolumeMT || 0).toLocaleString()} MT`}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-3.5 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Annual Value
                  </p>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                    {formatCompactUSD(marketSnapshot.annualImportValueUSD)}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-3.5 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    YoY Growth Rate
                  </p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                    +{marketSnapshot.growthRateYoY || 0}%
                  </p>
                </div>
              </div>

              {/* Major Origins Share Breakdown */}
              {marketSnapshot.majorOrigins && marketSnapshot.majorOrigins.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-zinc-800/80 p-4 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                    Destination Import Origin Shares ({marketSnapshot.destinationCountry})
                  </p>
                  <div className="space-y-2.5">
                    {marketSnapshot.majorOrigins.map((o, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 w-28 truncate">
                          {o.countryName}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-700/60 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400"
                            style={{ width: `${o.sharePercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums tracking-tight text-zinc-600 dark:text-zinc-400 w-10 text-right">
                          {o.sharePercent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Recommended Sourcing Origins */}
        <div>
          <button
            type="button"
            onClick={() => toggle('origins')}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Globe className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                2. Recommended Sourcing Origins (Ranked)
              </span>
            </div>
            {openSections['origins'] ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {openSections['origins'] && (
            <div className="px-5 pb-5 pt-1 space-y-2.5 bg-zinc-50/30 dark:bg-zinc-900/30">
              {recommendedOrigins.map((origin) => (
                <div
                  key={origin.rank}
                  className={`p-4 rounded-xl border transition-all ${
                    origin.rank === 1
                      ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/70 shadow-2xs'
                      : 'bg-white dark:bg-zinc-800/70 border-zinc-200/70 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          origin.rank === 1
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        #{origin.rank}
                      </span>
                      <span className="text-sm font-bold text-zinc-950 dark:text-white">
                        {origin.country}
                      </span>
                      {origin.rank === 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Primary Sourcing Hub
                        </span>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                      {origin.effectiveDuty}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
                    {origin.advantage}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>Estimated Transit & Lead Time: {origin.leadTimeDays}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Regulatory Standards, Certifications & Customs Clearance */}
        <div>
          <button
            type="button"
            onClick={() => toggle('compliance')}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                3. Mandatory Certifications & Customs Clearance Paperwork
              </span>
            </div>
            {openSections['compliance'] ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {openSections['compliance'] && (
            <div className="px-5 pb-5 pt-1 bg-zinc-50/30 dark:bg-zinc-900/30 space-y-4">
              {/* Product Certifications */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Product Safety & Regulatory Standards
                </p>
                <div className="space-y-2">
                  {complianceChecklist.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {c.item}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                          c.priority === 'critical'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/60'
                        }`}
                      >
                        {c.priority === 'critical' ? 'Mandatory' : 'Recommended'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customs Clearance Documentation */}
              {customsPaperwork && customsPaperwork.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Customs Clearance Documentation Prerequisites
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {customsPaperwork.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs flex items-start gap-2.5"
                      >
                        <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {doc.document}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                            {doc.purpose}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Assurance Protocols */}
              {qualityProtocols && qualityProtocols.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Quality Inspection & Assurance Protocol Gates
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {qualityProtocols.map((qp, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {qp.stage}
                          </span>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {qp.protocol}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                          {qp.standard}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Customs CIF Benchmark & Pricing Discipline */}
        <div>
          <button
            type="button"
            onClick={() => toggle('price')}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <DollarSign className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                4. Customs Declared CIF Values (Historical Baseline)
              </span>
            </div>
            {openSections['price'] ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {openSections['price'] && historicalPriceRef && (
            <div className="px-5 pb-5 pt-1 bg-zinc-50/30 dark:bg-zinc-900/30">
              <div className="p-4 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-800 mb-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                  <span className="text-xs text-zinc-500 font-medium">
                    Historical Customs CIF Range:
                  </span>
                  <span className="text-sm sm:text-base font-bold tabular-nums tracking-tight text-zinc-950 dark:text-white">
                    {formatCurrency(historicalPriceRef.low, historicalPriceRef.low < 10 ? 2 : 0)} –{' '}
                    {formatCurrency(historicalPriceRef.high, historicalPriceRef.high < 10 ? 2 : 0)}{' '}
                    {historicalPriceRef.unit}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{historicalPriceRef.basis}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <p className="text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed font-normal">
                  <strong className="font-semibold">Price Discovery Notice:</strong>{' '}
                  {historicalPriceRef.notice}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 5. Modeled Landed Cost Breakdown */}
        {landedCostTable && (
          <div>
            <button
              type="button"
              onClick={() => toggle('landed')}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
            >
              <div className="flex items-center gap-2.5">
                <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Package className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                  5. Modeled Landed Cost Breakdown
                </span>
                <span className="text-[11px] font-semibold tabular-nums tracking-tight px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                  +{landedCostTable.costDeltaPercent.toFixed(1)}% vs FOB
                </span>
              </div>
              {openSections['landed'] ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            {openSections['landed'] && (
              <div className="px-5 pb-5 pt-1 bg-zinc-50/30 dark:bg-zinc-900/30">
                <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 overflow-hidden shadow-2xs">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <div className="col-span-8">Cost Component</div>
                    <div className="col-span-4 text-right">Amount (USD)</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <div className="col-span-8 text-zinc-600 dark:text-zinc-300 font-medium">
                        Base Unit FOB
                      </div>
                      <div className="col-span-4 text-right tabular-nums font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(landedCostTable.basePriceUSD)}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <div className="col-span-8 text-zinc-600 dark:text-zinc-300 font-medium">
                        Ocean Freight ({landedCostTable.containerType})
                      </div>
                      <div className="col-span-4 text-right tabular-nums font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(landedCostTable.freightUSD)}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <div className="col-span-8 text-zinc-600 dark:text-zinc-300 font-medium">
                        Import Tariffs & Customs Duties
                      </div>
                      <div className="col-span-4 text-right tabular-nums font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(landedCostTable.dutyUSD)}{' '}
                        {landedCostTable.dutyLabel ? (
                          <span className="text-[10px] font-sans font-medium text-zinc-500 dark:text-zinc-400 ml-1">
                            ({landedCostTable.dutyLabel})
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <div className="col-span-8 text-zinc-600 dark:text-zinc-300 font-medium">
                        Import VAT / Port Handling
                      </div>
                      <div className="col-span-4 text-right tabular-nums font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(landedCostTable.vatUSD)}
                      </div>
                    </div>
                    {/* Total Summary Row */}
                    <div className="grid grid-cols-12 px-4 py-3 items-center bg-indigo-50/40 dark:bg-indigo-950/20 border-t border-indigo-100 dark:border-indigo-900/50">
                      <div className="col-span-7 font-bold text-zinc-950 dark:text-white text-xs sm:text-sm">
                        Estimated Total Landed / Unit
                      </div>
                      <div className="col-span-5 text-right tabular-nums text-sm sm:text-base font-bold tracking-tight text-indigo-700 dark:text-indigo-400">
                        {formatCurrency(landedCostTable.totalLandedPerUnitUSD)} USD
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 italic font-normal">
                  {landedCostTable.basis}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 6. Strategic Next Steps & Custom Buyer Instructions */}
        <div>
          <button
            type="button"
            onClick={() => toggle('next')}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                6. Sourcing Action Roadmap & Directives
              </span>
            </div>
            {openSections['next'] ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          {openSections['next'] && (
            <div className="px-5 pb-5 pt-1 bg-zinc-50/30 dark:bg-zinc-900/30 space-y-3">
              {/* Buyer Notes Callout if set */}
              {buyerNotes && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Buyer Custom Directives for RFQ</span>
                  </div>
                  <p className="text-xs text-indigo-950 dark:text-indigo-100 whitespace-pre-line leading-relaxed">
                    {buyerNotes}
                  </p>
                </div>
              )}

              {nextSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-xs p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-800 shadow-2xs"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
                    {idx + 1}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal pt-0.5">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Conversion Footer: Sourcing Brief & RFQ Launch ── */}
      <div className="p-4 sm:p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              RFQ Readiness Score:
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold tabular-nums tracking-tight bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {rfqReadyScore}%
            </span>
            {customizedByBuyer && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                (Brief fine-tuned by buyer)
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Parameters structured for immediate factory quotation on Proquoment supplier network.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleEdit}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
              isEditing
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-zinc-200 dark:border-zinc-700 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{isEditing ? 'Close Editor' : 'Edit Brief'}</span>
          </button>

          <button
            type="button"
            onClick={handleLaunchRFQ}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Launch RFQ with Brief</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
