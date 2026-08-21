import {
  RFQState,
  FieldEvidence,
  SourceType,
  FieldStatus,
  FieldConfidence,
  ProvenancedField
} from './types';
import { synthesizeRFQ } from './synthesizer';

// Priority map for source types (higher number = higher priority)
const SOURCE_PRIORITY: Record<SourceType, number> = {
  legacy_draft: 0,
  ai_proposal: 1,
  visual_inferred: 2,
  visual_confirmed: 3,
  ai_recommendation_approved: 3.5,
  uploaded_document: 4,
  buyer_message: 5,
  buyer_edit: 6,
};

// Paths that are NOT ProvenancedField — block AI from writing raw strings here
const BLOCKED_PATHS = new Set([
  'product.classification',
  'visual_intent',
  'readiness',
  'conflicts',
  'evidence_log',
  'questions_asked',
  'version',
]);

// Maps SourceType to FieldStatus
export function sourceTypeToStatus(source: SourceType): FieldStatus {
  switch (source) {
    case 'buyer_edit':
    case 'buyer_message':
    case 'visual_confirmed':
    case 'ai_recommendation_approved':
      return 'confirmed';
    case 'uploaded_document':
      return 'extracted';
    case 'visual_inferred':
      return 'inferred';
    case 'ai_proposal':
    case 'legacy_draft':
    default:
      return 'proposed';
  }
}

// Maps SourceType to FieldConfidence
export function sourceTypeToConfidence(source: SourceType): FieldConfidence {
  switch (source) {
    case 'buyer_edit':
    case 'buyer_message':
    case 'visual_confirmed':
    case 'ai_recommendation_approved':
      return 'confirmed';
    case 'uploaded_document':
      return 'high';
    case 'visual_inferred':
      return 'medium';
    case 'ai_proposal':
    case 'legacy_draft':
    default:
      return 'low';
  }
}

// H4 FIX: Map well-known flat keys to their correct dot-notation paths
const FLAT_KEY_REMAP: Record<string, string> = {
  quantity: 'quantity.required_quantity',
  moq: 'commercial.supplier_moq',
  unit: 'quantity.unit',
  breakdown: 'quantity.breakdown',
  target_price: 'commercial.target_price',
  price: 'commercial.target_price',
  payment_terms: 'commercial.payment_terms',
  incoterm: 'commercial.incoterm',
  destination: 'logistics.destination_country',
  shipping: 'logistics.shipping_mode',
  shipping_method: 'logistics.shipping_mode',
  port: 'logistics.destination_port',
  packaging: 'packaging.packaging_type',
  name: 'product.name',
  description: 'product.description',
  intended_use: 'product.intended_use',
  buyer_segment: 'product.buyer_segment',
};

// Get a field's current value from state using dot notation
export function getFieldFromState(state: RFQState, fieldPath: string): ProvenancedField | null {
  const parts = fieldPath.split('.');

  if (parts.length === 1) {
    // H4 FIX: check flat key remaps first
    const remapped = FLAT_KEY_REMAP[fieldPath];
    if (remapped) return getFieldFromState(state, remapped);
    return state.specifications?.[fieldPath] || null;
  }

  let current: any = state;
  for (const part of parts) {
    if (current === undefined || current === null) return null;
    current = current[part];
  }
  return current as ProvenancedField | null;
}

// Set a field in state immutably using dot notation
export function setFieldInState(state: RFQState, fieldPath: string, newValue: ProvenancedField): RFQState {
  // H3 FIX: block writes to non-ProvenancedField structural paths
  if (BLOCKED_PATHS.has(fieldPath)) {
    console.warn(`[state-manager] blocked write to structural path "${fieldPath}" — use specific sub-paths`);
    return state;
  }

  const parts = fieldPath.split('.');

  if (parts.length === 1) {
    // H4 FIX: remap known flat keys to correct locations
    const remapped = FLAT_KEY_REMAP[fieldPath];
    if (remapped) {
      return setFieldInState(state, remapped, newValue);
    }
    // Default to specifications for truly unknown flat keys
    return {
      ...state,
      specifications: {
        ...state.specifications,
        [fieldPath]: newValue,
      },
    };
  }

  // Deep clone strategy for nested paths
  const newState = { ...state } as any;
  let current: any = newState;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    } else {
      current[part] = { ...current[part] };
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = newValue;
  return newState as RFQState;
}

export function applyFieldPatch(
  state: RFQState,
  // H2 FIX: accept single FieldEvidence OR array
  updates: FieldEvidence[] | FieldEvidence
): { newState: RFQState; changedFields: string[] } {
  // H2 FIX: normalize to array
  const normalizedUpdates = Array.isArray(updates) ? updates : [updates];

  const changedFields: string[] = [];
  let newState = { ...state, evidence_log: [...state.evidence_log] };

  for (const update of normalizedUpdates) {
    if (!update || !update.field) continue;

    const current = getFieldFromState(newState, update.field);

    // Priority check
    if (current) {
      const currentPriority = SOURCE_PRIORITY[current.source_type] ?? 0;
      const newPriority = SOURCE_PRIORITY[update.source_type] ?? 0;

      // H10 FIX: buyer_message can always override buyer_edit (user correcting via chat)
      const isChatOverride = update.source_type === 'buyer_message';
      if (!isChatOverride && newPriority < currentPriority) {
        continue;
      }

      // Reject AI proposals for fields buyer has explicitly confirmed (still respect buyer intent)
      if (current.buyer_confirmed && update.source_type === 'ai_proposal') {
        continue;
      }
    }

    // Apply the update
    newState = setFieldInState(newState, update.field, {
      value: update.proposed_value != null ? String(update.proposed_value) : null,
      status: sourceTypeToStatus(update.source_type),
      confidence: sourceTypeToConfidence(update.source_type),
      source_type: update.source_type,
      source_id: update.source_id,
      // M4 FIX: visual_confirmed should also set buyer_confirmed: true
      buyer_confirmed:
        update.source_type === 'buyer_edit' ||
        update.source_type === 'buyer_message' ||
        update.source_type === 'visual_confirmed' ||
        update.source_type === 'ai_recommendation_approved',
      supplier_proposed: false,
      updated_at: new Date().toISOString(),
    });

    // Add to evidence log
    newState.evidence_log.push(update);
    changedFields.push(update.field);
  }

  // Run the pure synthesis pipeline on the new state
  newState = synthesizeRFQ(newState);

  return { newState, changedFields };
}

// Initial empty state factory
export function createEmptyRFQState(): RFQState {
  let emptyState: RFQState = {
    version: 2,
    product: {
      name: null,
      classification: null,
      intended_use: null,
      description: null,
      buyer_segment: null,
    },
    quantity: {
      required_quantity: null,
      unit: null,
      breakdown: null,
    },
    specifications: {},
    visual_intent: {
      references: [],
      accepted_attributes: [],
      rejected_attributes: [],
    },
    manufacturing: {},
    quality: {},
    compliance: {},
    commercial: {},
    logistics: {},
    packaging: {},
    special_requirements: {},
    evidence_log: [],
    conflicts: [],
    questions_asked: [],
    readiness: {
      status: 'not_ready',
      blocking_fields: [],
      recommended_fields: [],
      optional_fields: [],
      summary: 'RFQ is empty',
    },
    metadata: {
      mode: 'standard',
      complexity: 'simple'
    }
  };
  
  return synthesizeRFQ(emptyState);
}
