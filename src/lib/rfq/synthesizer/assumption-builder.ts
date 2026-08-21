import { RFQState, AssumptionRegister, FieldCriticality } from '../types';
import { getSchemaForCategory } from '../schemas';
import { evaluateFieldCriticality } from './field-criticality';

export function buildAssumptionRegister(state: RFQState): AssumptionRegister {
  const schemaKey = state.product.classification?.schema_key || 'generic';
  const schema = getSchemaForCategory(schemaKey);
  const criticalities = evaluateFieldCriticality(state);

  const register: AssumptionRegister = {
    buyer_confirmed: [],
    ai_recommended_approved: [],
    ai_inferred: [],
    supplier_dependent: [],
    unknown: [],
    not_applicable: [],
  };

  const getField = (key: string) => {
    const parts = key.split('.');
    if (parts.length === 2) {
      const section = (state as any)[parts[0]];
      return section?.[parts[1]];
    }
    return null;
  };

  for (const [fieldKey, def] of Object.entries(schema.fields)) {
    const field = getField(fieldKey);
    const crit = criticalities[fieldKey] || 'medium';

    if (field?.value) {
      if (field.value === 'Not Applicable' || crit === 'not_applicable') {
        register.not_applicable.push({ field: fieldKey, label: def.label, reason: 'N/A' });
      } else if (field.buyer_confirmed) {
        if (field.source_type === 'ai_recommendation_approved') {
          register.ai_recommended_approved.push({ field: fieldKey, label: def.label, value: field.value, reason: 'AI Recommended and Buyer Approved' });
        } else {
          register.buyer_confirmed.push({ field: fieldKey, label: def.label, value: field.value });
        }
      } else if (field.source_type === 'ai_proposal' || field.source_type === 'visual_inferred' || field.source_type === 'uploaded_document') {
        register.ai_inferred.push({ field: fieldKey, label: def.label, value: field.value, reason: `Sourced from ${field.source_type}` });
      } else {
        // Fallback for other sourced info not yet confirmed
        register.ai_inferred.push({ field: fieldKey, label: def.label, value: field.value, reason: 'Extracted / Proposed' });
      }
    } else {
      // Missing
      if (crit === 'not_applicable') {
        register.not_applicable.push({ field: fieldKey, label: def.label, reason: 'Dependencies skipped' });
      } else if (def.buyer_side === false || crit === 'supplier_dependent') {
        register.supplier_dependent.push({ field: fieldKey, label: def.label });
      } else {
        register.unknown.push({ field: fieldKey, label: def.label, criticality: crit });
      }
    }
  }

  return register;
}
