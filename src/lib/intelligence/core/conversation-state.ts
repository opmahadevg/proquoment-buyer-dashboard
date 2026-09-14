export type SpecStage =
  | 'product'        // Stage 1: product name / category
  | 'quantity'       // Stage 2: quantity + unit
  | 'destination'    // Stage 3: destination country / port
  | 'specifications' // Stage 4: material grade, certifications, packaging
  | 'timeline'       // Stage 5: lead time, budget range (optional)
  | 'confirmation'   // Stage 6: recap full information, ask buyer to prepare briefing or add more details
  | 'complete';      // Stage 7: buyer confirmed -> prepare Executive Sourcing Briefing

export interface AccumulatedSpecs {
  product?: string;
  category?: string;
  hsCode?: string;
  quantity?: number;
  unit?: string;
  destination?: string;
  port?: string;
  materialGrade?: string;
  certifications?: string[];
  packaging?: string;
  dimensions?: string;
  targetLeadTimeDays?: number;
  budgetRangeUSD?: { min?: number; max?: number };
  additionalNotes?: string;
  /** Proactive AI-suggested fields pending or approved by buyer */
  aiSuggestedFields?: Record<string, {
    value: string;
    reason: string;
    confirmed: boolean;
  }>;
}

export interface SpecElicitationState {
  currentStage: SpecStage;
  completedStages: SpecStage[];
  accumulatedSpecs: AccumulatedSpecs;
  turnCount: number;
  sessionId: string;
}

export function createInitialElicitationState(sessionId: string): SpecElicitationState {
  return {
    currentStage: 'product',
    completedStages: [],
    accumulatedSpecs: {},
    turnCount: 0,
    sessionId,
  };
}

export function isResearchReady(state: SpecElicitationState): boolean {
  // Minimum criteria: product + quantity + destination confirmed and reached complete stage
  const s = state.accumulatedSpecs;
  return Boolean(s.product && s.quantity && s.destination && state.currentStage === 'complete');
}

export function nextStage(current: SpecStage): SpecStage {
  const order: SpecStage[] = ['product', 'quantity', 'destination', 'specifications', 'timeline', 'confirmation', 'complete'];
  const idx = order.indexOf(current);
  return order[idx + 1] ?? 'complete';
}

/**
 * Safely merges accumulated specs across turns without overwriting non-empty fields
 * with null/undefined values emitted by model schema outputs.
 * Also scans conversation history as a resilient safety net.
 */
export function mergeAccumulatedSpecs(
  current: AccumulatedSpecs = {},
  updates: Partial<AccumulatedSpecs> = {},
  history?: { role: string; content: string }[]
): AccumulatedSpecs {
  const merged: AccumulatedSpecs = { ...current };

  // 1. Merge scalar fields safely (never overwrite truthy with null/undefined/empty)
  if (updates.product && typeof updates.product === 'string' && updates.product.trim()) {
    merged.product = updates.product.trim();
  }
  if (updates.category && typeof updates.category === 'string' && updates.category.trim()) {
    merged.category = updates.category.trim();
  }
  if (updates.hsCode && typeof updates.hsCode === 'string' && updates.hsCode.trim()) {
    merged.hsCode = updates.hsCode.trim();
  }
  if (typeof updates.quantity === 'number' && !isNaN(updates.quantity) && updates.quantity > 0) {
    merged.quantity = updates.quantity;
  }
  if (updates.unit && typeof updates.unit === 'string' && updates.unit.trim()) {
    merged.unit = updates.unit.trim();
  }
  if (updates.destination && typeof updates.destination === 'string' && updates.destination.trim()) {
    merged.destination = updates.destination.trim();
  }
  if (updates.port && typeof updates.port === 'string' && updates.port.trim()) {
    merged.port = updates.port.trim();
  }
  if (updates.materialGrade && typeof updates.materialGrade === 'string' && updates.materialGrade.trim()) {
    merged.materialGrade = updates.materialGrade.trim();
  }
  if (updates.packaging && typeof updates.packaging === 'string' && updates.packaging.trim()) {
    merged.packaging = updates.packaging.trim();
  }
  if (updates.dimensions && typeof updates.dimensions === 'string' && updates.dimensions.trim()) {
    merged.dimensions = updates.dimensions.trim();
  }
  if (typeof updates.targetLeadTimeDays === 'number' && updates.targetLeadTimeDays > 0) {
    merged.targetLeadTimeDays = updates.targetLeadTimeDays;
  }
  if (updates.budgetRangeUSD && (updates.budgetRangeUSD.min || updates.budgetRangeUSD.max)) {
    merged.budgetRangeUSD = { ...merged.budgetRangeUSD, ...updates.budgetRangeUSD };
  }
  if (updates.additionalNotes && updates.additionalNotes.trim()) {
    merged.additionalNotes = updates.additionalNotes.trim();
  }

  // 2. Merge certifications array
  if (Array.isArray(updates.certifications) && updates.certifications.length > 0) {
    const combined = [...(merged.certifications || []), ...updates.certifications];
    merged.certifications = Array.from(new Set(combined.filter((c) => Boolean(c && typeof c === 'string' && c.trim()))));
  }

  // 2.5 Merge aiSuggestedFields
  if (updates.aiSuggestedFields && typeof updates.aiSuggestedFields === 'object') {
    merged.aiSuggestedFields = {
      ...(merged.aiSuggestedFields || {}),
      ...updates.aiSuggestedFields,
    };
  }

  // 3. Conversation history fallback scan if key fields are still missing
  if (history && history.length > 0) {
    const userTexts = history
      .filter((h) => h.role === 'user')
      .map((h) => h.content)
      .join(' ');
    const lower = userTexts.toLowerCase();

    // Recover destination if missing
    if (!merged.destination) {
      if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.a') || lower.includes('america')) {
        merged.destination = 'United States';
      } else if (lower.includes('indonesia') || lower.includes('jakarta')) {
        merged.destination = 'Indonesia';
      } else if (lower.includes('uae') || lower.includes('dubai') || lower.includes('jebel ali')) {
        merged.destination = 'UAE';
      } else if (lower.includes('vietnam')) {
        merged.destination = 'Vietnam';
      } else if (lower.includes('india')) {
        merged.destination = 'India';
      } else if (lower.includes('germany')) {
        merged.destination = 'Germany';
      }
    }

    // Recover quantity if missing
    if (!merged.quantity) {
      const qMatch = userTexts.match(/\b(\d+[\d,.]*)\s*(pcs|pieces?|units?|mt|metric tons?|tons?|kg|containers?|fcl)\b/i);
      if (qMatch) {
        merged.quantity = Number(qMatch[1].replace(/,/g, ''));
        merged.unit = qMatch[2].toLowerCase();
      }
    }

    // Recover material / food contact certification if in history
    if (!merged.materialGrade) {
      if (lower.includes('ceramic') || lower.includes('stoneware') || lower.includes('porcelain')) {
        const ceramicMatch = userTexts.match(/(11oz|15oz)?\s*(glazed\s+ceramic|ceramic|stoneware|porcelain)[^,.\n]*/i);
        if (ceramicMatch) {
          merged.materialGrade = ceramicMatch[0].trim();
        }
      }
    }

    if (lower.includes('fda') && (!merged.certifications || !merged.certifications.some((c) => c.toLowerCase().includes('fda')))) {
      merged.certifications = [...(merged.certifications || []), 'FDA Food Contact Standard'];
    }
  }

  return merged;
}

