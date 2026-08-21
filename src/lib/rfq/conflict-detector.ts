import { RFQState, RFQConflict, FieldEvidence, SourceType } from './types';

// Helps compare values semantically in a real implementation (e.g. "100" vs "100 pcs")
// For now, we do simple string matching or rely on the LLM to flag conflicts.
function valuesConflict(val1: string, val2: string): boolean {
  if (!val1 || !val2) return false;
  // Simple case-insensitive comparison
  return val1.trim().toLowerCase() !== val2.trim().toLowerCase();
}

export function detectConflicts(state: RFQState, newEvidence: FieldEvidence[]): RFQConflict[] {
  const newConflicts: RFQConflict[] = [];

  // In a full implementation, we would compare newEvidence against existing state
  // and log conflicts if a lower-priority source proposes something different
  // than a higher-priority source, OR if two equal priority sources differ.
  // We don't auto-overwrite higher priority sources.

  // Example MVP logic:
  // We assume AI has already done some conflict detection and we just track it.
  // If the AI proposes an update to a field that is already 'confirmed' by the buyer,
  // and the value is different, that's a conflict (AI thinks X, Buyer said Y).

  for (const evidence of newEvidence) {
    const parts = evidence.field.split('.');
    
    // Find current field value
    let currentField: any = null;
    if (parts.length === 1) {
      currentField = state.specifications[evidence.field];
    } else {
      let currentObj: any = state;
      let found = true;
      for (const part of parts) {
        if (currentObj === undefined || currentObj === null) {
          found = false;
          break;
        }
        currentObj = currentObj[part];
      }
      if (found) currentField = currentObj;
    }

    if (currentField && currentField.value && currentField.buyer_confirmed) {
      if (valuesConflict(currentField.value, evidence.proposed_value)) {
        // AI is proposing something different from what buyer confirmed
        newConflicts.push({
          id: `conflict_${Date.now()}_${evidence.field}`,
          field: evidence.field,
          sources: [
            {
              source_type: currentField.source_type,
              source_id: currentField.source_id,
              value: currentField.value,
              label: 'Current State'
            },
            {
              source_type: evidence.source_type,
              source_id: evidence.source_id,
              value: evidence.proposed_value,
              label: 'New Evidence'
            }
          ],
          resolved: false
        });
      }
    }
  }

  return newConflicts;
}
