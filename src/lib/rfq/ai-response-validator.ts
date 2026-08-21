import { FieldEvidence, SourceType } from './types';

// C2 FIX: Added ai_options and multi_select fields
export interface AIStructuredResponse {
  buyer_message: string;            // The conversational reply to the user
  rfq_updates: FieldEvidence[];     // Proposed or extracted data updates
  internal_reasoning: string;       // Explain why questions were asked or values inferred
  observations?: string[];          // Visual observations from reference images
  inferences?: string[];            // Visual inferences from reference images
  unknowns?: string[];              // Non-visual attributes that cannot be determined visually
  new_questions: string[];          // Field keys it wants to ask about next
  ai_options: Array<{ value: string; label: string }>;  // Quick-reply chips
  multi_select: boolean;            // Whether buyer can select multiple options
}

// Basic validation to ensure the LLM output conforms to our schema
export function validateAIResponse(data: any): AIStructuredResponse {
  if (!data) throw new Error('Empty response from AI');

  if (typeof data.buyer_message !== 'string') {
    throw new Error("Missing or invalid 'buyer_message' in AI response");
  }

  // C2 FIX: preserve ai_options and multi_select through validator
  const response: AIStructuredResponse = {
    buyer_message: data.buyer_message,
    rfq_updates: [],
    internal_reasoning: data.internal_reasoning || '',
    observations: Array.isArray(data.observations) ? data.observations.map(String) : [],
    inferences: Array.isArray(data.inferences) ? data.inferences.map(String) : [],
    unknowns: Array.isArray(data.unknowns) ? data.unknowns.map(String) : [],
    new_questions: Array.isArray(data.new_questions) ? data.new_questions : [],
    ai_options: Array.isArray(data.ai_options)
      ? data.ai_options.filter(
          (opt: any) => opt && typeof opt.value === 'string' && typeof opt.label === 'string'
        )
      : [],
    multi_select: data.multi_select === true,
  };

  if (Array.isArray(data.rfq_updates)) {
    for (const update of data.rfq_updates) {
      if (!update.field || typeof update.field !== 'string') continue;

      response.rfq_updates.push({
        field: update.field,
        // M7 FIX: use != null check instead of truthy — preserves "0", "false" etc.
        proposed_value: update.proposed_value != null ? String(update.proposed_value) : '',
        source_type: (update.source_type as SourceType) || 'ai_proposal',
        source_id: update.source_id || null,
        reason: update.reason,
        source_reference: update.source_reference,
      });
    }
  }

  return response;
}
