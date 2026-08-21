import { RFQState, ProvenancedField } from '../types';
import { getSchemaForCategory } from '../schemas';

/**
 * Resolve field dependencies:
 * - If branding_required = "no", mark all dependent branding fields as NOT_APPLICABLE
 * - If FOB selected without origin, don't assume China
 * - Cascade N/A status through dependency chains
 */
export function resolveDependencies(state: RFQState): RFQState {
  const schemaKey = state.product.classification?.schema_key || 'generic';
  const schema = getSchemaForCategory(schemaKey);
  let newState = { ...state, specifications: { ...state.specifications } };

  for (const [fieldKey, def] of Object.entries(schema.fields)) {
    if (!def.skip_when) continue;

    for (const [depKey, skipValues] of Object.entries(def.skip_when)) {
      // Get the value of the dependency field
      const depParts = depKey.split('.');
      let depField: ProvenancedField | null = null;

      if (depParts.length === 2) {
        const section = (newState as any)[depParts[0]];
        if (section && section[depParts[1]]) {
          depField = section[depParts[1]];
        }
      }

      if (depField?.value && skipValues.includes(depField.value.toLowerCase())) {
        // This field should be N/A
        const fieldParts = fieldKey.split('.');
        if (fieldParts.length === 2) {
          const sectionKey = fieldParts[0] as keyof RFQState;
          const fieldName = fieldParts[1];
          const section = (newState as any)[sectionKey];

          if (section && typeof section === 'object' && !Array.isArray(section)) {
            // Only set N/A if field doesn't already have a buyer-confirmed value
            const existing = section[fieldName] as ProvenancedField | undefined;
            if (!existing || !existing.buyer_confirmed) {
              (newState as any)[sectionKey] = {
                ...section,
                [fieldName]: {
                  value: 'Not Applicable',
                  status: 'confirmed' as const,
                  confidence: 'confirmed' as const,
                  source_type: 'ai_proposal' as const,
                  source_id: null,
                  buyer_confirmed: false,
                  supplier_proposed: false,
                  updated_at: new Date().toISOString(),
                  _not_applicable: true,
                } as ProvenancedField & { _not_applicable: boolean },
              };
            }
          }
        }
      }
    }
  }

  return newState;
}
