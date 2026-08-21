import { RFQState, MissingFieldEntry, MissingFieldStatus, FieldCriticality } from '../types';
import { getSchemaForCategory } from '../schemas';
import { evaluateFieldCriticality } from './field-criticality';

/**
 * Classify every missing field into a meaningful status.
 * Never just show "TBD" — classify WHY it's missing.
 */
export function classifyMissingFields(state: RFQState): MissingFieldEntry[] {
  const schemaKey = state.product.classification?.schema_key || 'generic';
  const schema = getSchemaForCategory(schemaKey);
  const criticalities = evaluateFieldCriticality(state);
  const missing: MissingFieldEntry[] = [];

  const getVal = (key: string): string | null => {
    const parts = key.split('.');
    if (parts.length === 2) {
      const section = (state as any)[parts[0]];
      const field = section?.[parts[1]];
      if (field?.value && field.value !== 'Not Applicable') return field.value;
    }
    return null;
  };

  for (const [fieldKey, def] of Object.entries(schema.fields)) {
    const value = getVal(fieldKey);
    if (value) continue; // Field has a value, skip

    const criticality = criticalities[fieldKey] || 'medium';
    let status: MissingFieldStatus;
    let reason: string | undefined;

    // Check if field is N/A due to dependencies
    if (criticality === 'not_applicable') {
      status = 'not_applicable';
      reason = 'Not relevant for this product configuration';
    } else if (def.buyer_side === false || criticality === 'supplier_dependent') {
      status = 'supplier_dependent';
      reason = 'Supplier will provide in quotation response';
    } else if (criticality === 'critical') {
      status = 'critical_missing';
      reason = 'Must be clarified before supplier quotation';
    } else if (criticality === 'high' || def.requirement === 'required') {
      status = 'critical_missing';
      reason = 'Required for accurate supplier quotation';
    } else if (def.requirement === 'recommended' || criticality === 'medium') {
      status = 'recommended_missing';
      reason = 'Would materially improve quotation accuracy';
    } else {
      status = 'optional_missing';
      reason = 'Useful but suppliers can quote without it';
    }

    // Check skip_when dependencies for N/A
    if (def.skip_when) {
      for (const [depKey, skipVals] of Object.entries(def.skip_when)) {
        const depVal = getVal(depKey);
        if (depVal && skipVals.includes(depVal.toLowerCase())) {
          status = 'not_applicable';
          reason = `Not applicable because ${def.label} is skipped`;
          break;
        }
      }
    }

    missing.push({
      field: fieldKey,
      label: def.label,
      status,
      criticality,
      reason,
    });
  }

  return missing;
}
