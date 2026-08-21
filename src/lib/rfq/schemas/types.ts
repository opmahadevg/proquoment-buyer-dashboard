import { FieldRequirement } from '../types';

export interface CategorySchema {
  id: string;                       // e.g. 'footwear'
  name: string;                     // e.g. 'Footwear'
  fields: Record<string, CategoryFieldDefinition>;
}

export interface CategoryFieldDefinition {
  requirement: FieldRequirement;    // 'required', 'recommended', 'optional'
  label: string;                    // Human-readable: "Outsole Material"
  description?: string;             // Helper text for the buyer or AI
  options?: string[];               // For enums (e.g., sizes, materials)
  ai_prompt_hint?: string;          // Extra instruction for the AI (e.g., "Remind them EVA is lighter than rubber")
  priority?: 'critical' | 'high' | 'medium' | 'low' | 'optional';  // priority metadata
  layer?: 'intent' | 'specification' | 'customization' | 'compliance' | 'quality' | 'commercial' | 'logistics'; // logical layer
  depends_on?: Record<string, string[]>;  // conditional dependency
  skip_when?: Record<string, string[]>;   // inverse dependency
  question_template?: string;       // contextual question template
  recommendation_available?: boolean; // if AI can recommend when buyer doesn't know
  // NEW fields for synthesis engine
  buyer_side?: boolean;           // true = buyer requirement (default). false = supplier response field
  normalize_unit?: string;        // Target unit for normalization e.g. "mm", "units"
  parent_taxonomy?: string;       // e.g. "material" for "material_grade"
  criticality_rules?: Array<{    // Dynamic criticality based on other field values
    when: Record<string, string[]>;   // conditions: { 'product.intended_use': ['restaurant', 'food'] }
    criticality: import('../types').FieldCriticality;
  }>;
  default_criticality?: import('../types').FieldCriticality;
}
