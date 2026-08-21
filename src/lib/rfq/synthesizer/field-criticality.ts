import { RFQState, FieldCriticality } from '../types';
import { getSchemaForCategory } from '../schemas';

/**
 * Evaluate dynamic field criticality based on product context.
 * Returns a map of field → criticality level.
 * 
 * Example: For a food-contact product, compliance.food_contact becomes 'critical'.
 */
export function evaluateFieldCriticality(state: RFQState): Record<string, FieldCriticality> {
  const schemaKey = state.product.classification?.schema_key || 'generic';
  const schema = getSchemaForCategory(schemaKey);
  const result: Record<string, FieldCriticality> = {};

  // Helper to get a field value for rule evaluation
  const getVal = (key: string): string | null => {
    const parts = key.split('.');
    if (parts.length === 2) {
      const section = (state as any)[parts[0]];
      return section?.[parts[1]]?.value?.toLowerCase() || null;
    }
    return null;
  };

  for (const [fieldKey, def] of Object.entries(schema.fields)) {
    // Start with default
    let criticality: FieldCriticality = def.default_criticality || 'medium';

    // Check criticality rules (dynamic overrides)
    if (def.criticality_rules) {
      for (const rule of def.criticality_rules) {
        let allMatch = true;
        for (const [condKey, condValues] of Object.entries(rule.when)) {
          const currentVal = getVal(condKey);
          if (!currentVal || !condValues.some(v => currentVal.includes(v.toLowerCase()))) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          criticality = rule.criticality;
          break; // First matching rule wins
        }
      }
    }

    // Supplier-side fields are always supplier_dependent by default
    if (def.buyer_side === false && criticality !== 'not_applicable') {
      criticality = 'supplier_dependent';
    }

    result[fieldKey] = criticality;
  }

  return result;
}
