import { RFQData } from '@/app/new-product/components/NewProductFlow';
import { RFQState, ProvenancedField } from './types';
import { createEmptyRFQState } from './state-manager';
import { synthesizeRFQ } from './synthesizer';

// Helper to convert an old simple string value to a ProvenancedField
function migrateValue(value: string | undefined | null, pending?: boolean): ProvenancedField | null {
  if (value === undefined || value === null || value === '') return null;
  return {
    value,
    status: pending ? 'proposed' : 'confirmed',
    confidence: 'low',
    source_type: 'legacy_draft',
    source_id: null,
    buyer_confirmed: !pending,
    supplier_proposed: false,
    updated_at: new Date().toISOString()
  };
}

export function fromLegacyRFQData(old: RFQData | Partial<RFQData>): RFQState {
  const state = createEmptyRFQState();

  // Basic product fields
  if (old.productName) state.product.name = migrateValue(old.productName);
  if (old.category) {
    state.product.classification = {
      broad_category: old.category,
      subcategory: 'Unknown',
      product_type: 'Unknown',
      schema_key: 'generic'
    };
  }
  if (old.intendedUse) state.product.intended_use = migrateValue(old.intendedUse);
  if (old.description) state.product.description = migrateValue(old.description);
  if (old.moq) state.quantity.required_quantity = migrateValue(old.moq);

  // Specifications
  if (old.specifications && Array.isArray(old.specifications)) {
    for (const spec of old.specifications) {
      if (spec.label && spec.value) {
        state.specifications[spec.label] = migrateValue(spec.value, spec.pending) as ProvenancedField;
      }
    }
  }

  // Manufacturing Notes
  if (old.manufacturingNotes && Array.isArray(old.manufacturingNotes)) {
    for (const note of old.manufacturingNotes) {
      if (note.label && note.value) {
        state.manufacturing[note.label] = migrateValue(note.value, note.pending) as ProvenancedField;
      }
    }
  }

  // Commercial Terms
  if (old.commercialTerms && Array.isArray(old.commercialTerms)) {
    for (const term of old.commercialTerms) {
      if (term.label && term.value) {
        state.commercial[term.label] = migrateValue(term.value, term.pending) as ProvenancedField;
      }
    }
  }

  // Try to preserve ambiguities as unresolved conflicts
  if (old.ambiguities && Array.isArray(old.ambiguities)) {
    old.ambiguities.forEach((ambiguity, i) => {
      state.conflicts.push({
        id: `legacy_ambiguity_${i}`,
        field: 'unknown',
        sources: [],
        resolved: false,
        resolution: ambiguity
      });
    });
  }

  return synthesizeRFQ(state);
}

export function toLegacyRFQData(state: RFQState): RFQData {
  const data: RFQData = {
    productName: state.product.name?.value || '',
    category: state.product.classification?.broad_category || '',
    intendedUse: state.product.intended_use?.value || '',
    description: state.product.description?.value || '',
    moq: state.quantity.required_quantity?.value?.toString() || '',
    specifications: [],
    manufacturingNotes: [],
    commercialTerms: [],
    ambiguities: [],
    categoryRelevantFields: [], // No longer supported exactly in legacy form, can be omitted or mocked
    missingFields: []
  };

  for (const [key, field] of Object.entries(state.specifications)) {
    const f = field as any;
    if (f.value) {
      data.specifications.push({
        label: key,
        value: f.value,
        pending: !f.buyer_confirmed
      });
    }
  }

  for (const [key, field] of Object.entries(state.manufacturing)) {
    const f = field as any;
    if (f.value) {
      data.manufacturingNotes.push({
        label: key,
        value: f.value,
        pending: !f.buyer_confirmed
      });
    }
  }

  for (const [key, field] of Object.entries(state.commercial)) {
    const f = field as any;
    if (f.value) {
      data.commercialTerms.push({
        label: key,
        value: f.value,
        pending: !f.buyer_confirmed
      });
    }
  }

  // Collect unresolved conflicts as ambiguities
  data.ambiguities = state.conflicts
    .filter(c => !c.resolved)
    .map(c => c.resolution || `Conflict in ${c.field}`);

  return data;
}
