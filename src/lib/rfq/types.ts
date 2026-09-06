// ─── Provenance ──────────────────────────────────────────────────────
export type FieldStatus = 'confirmed' | 'extracted' | 'inferred' | 'proposed';
export type FieldConfidence = 'confirmed' | 'high' | 'medium' | 'low';

export type SourceType =
  | 'buyer_message'      // Explicit buyer statement in chat
  | 'buyer_edit'         // Buyer manually edited a field in the RFQ panel
  | 'uploaded_document'  // Extracted from uploaded PDF/DOC/image
  | 'visual_confirmed'   // Buyer confirmed a visual inference
  | 'visual_inferred'    // AI observed from reference images
  | 'ai_recommendation_approved' // AI recommended and buyer approved
  | 'ai_proposal'        // AI suggested this value (not yet approved)
  | 'legacy_draft';      // Migrated from old RFQData format

// Source priority (highest to lowest):
// buyer_edit > buyer_message > uploaded_document > visual_confirmed
//   > ai_recommendation_approved > visual_inferred > ai_proposal > legacy_draft

// ─── Field Criticality (dynamic per product) ────────────────────────
export type FieldCriticality = 'critical' | 'high' | 'medium' | 'low' | 'optional' | 'supplier_dependent' | 'not_applicable';

// ─── Missing Field Classification ───────────────────────────────────
export type MissingFieldStatus =
  | 'critical_missing'       // Must be clarified before supplier quotation
  | 'recommended_missing'    // Would materially improve quotation accuracy
  | 'optional_missing'       // Useful but suppliers can quote without it
  | 'supplier_dependent'     // Buyer doesn't provide; supplier responds
  | 'not_applicable'         // Confirmed irrelevant for this product
  | 'unknown';               // Status cannot be determined

// ─── Per-Section Readiness ──────────────────────────────────────────
export interface SectionReadiness {
  section: string;           // 'product_overview' | 'technical' | 'customization' | 'quality_compliance' | 'commercial' | 'logistics' | 'packaging'
  label: string;             // Human-readable: "Technical Specifications"
  score: number;             // 0-100
  weight: number;            // Dynamic weight (0-1) based on product relevance
  total_fields: number;
  filled_fields: number;
  critical_missing: string[];
  recommended_missing: string[];
}

export interface ProvenancedField {
  value: string | null;
  status: FieldStatus;
  confidence: FieldConfidence;
  source_type: SourceType;
  source_id: string | null;        // msg_id, ref_id, doc_id, null for legacy
  buyer_confirmed: boolean;
  supplier_proposed: boolean;       // "Let supplier propose" flag
  updated_at: string;               // ISO timestamp of last update
}

export interface FieldEvidence {
  field: string;
  proposed_value: string;
  source_type: SourceType;
  source_id: string | null;
  reason?: string;                  // Why this value was proposed
  source_reference?: string;        // e.g. "page 2, paragraph 3" for documents
}

// ─── Chat Image & Message Domain Models ──────────────────────────────────
export type ChatImageSource = 'upload' | 'url';

export interface ChatImage {
  id: string;              // Unique identifier (e.g. img_1724123456_a1b2)
  url: string;             // Base64 Data URL or persistent Object Storage URL
  title?: string;          // Optional user description or filename
  mimeType: string;        // 'image/jpeg' | 'image/png' | 'image/webp'
  size: number;            // File size in bytes
  source: ChatImageSource; // Origin of attachment
}

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  images?: ChatImage[];
  timestamp: string;      // ISO string
}

// ─── Visual Intent ───────────────────────────────────────────────────
export type VisualGateStatus =
  | 'idle'
  | 'ready_to_prompt'
  | 'generating'
  | 'ready_for_review'
  | 'revising'
  | 'buyer_confirmed'
  | 'bypassed';

export interface VisualObservation {
  image_id: string;
  image_url: string;
  observations: string[];           // Factual: "white upper", "lace closure"
  inferences: string[];             // AI-derived: "appears to be engineered mesh"
  buyer_notes: string[];            // Buyer-written notes on this image
  rejected_attributes: string[];    // "do not use this logo"
}

export interface VisualIteration {
  iteration: number;
  version: number;
  image_url: string;
  prompt_used?: string;
  specs_summary?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'superseded' | 'bypassed';
  buyer_action?: 'approved' | 'modified' | 'bypassed';
  buyer_comment?: string;
  timestamp: string;
}

// ─── Conflicts ───────────────────────────────────────────────────────
export interface RFQConflict {
  id: string;
  field: string;
  sources: Array<{
    source_type: SourceType;
    source_id: string | null;
    value: string;
    label: string;                  // Human-readable: "Uploaded document", "Chat message"
  }>;
  resolved: boolean;
  resolution?: string;
  resolved_at?: string;
}

// ─── Readiness ───────────────────────────────────────────────────────
export type ReadinessStatus = 'not_ready' | 'needs_clarification' | 'sourceable';

export type FieldRequirement = 'required' | 'recommended' | 'optional' | 'supplier_proposable';

export interface ReadinessAssessment {
  status: ReadinessStatus;
  blocking_fields: string[];        // Required fields that are missing/unresolved
  recommended_fields: string[];     // Useful but non-blocking
  optional_fields: string[];
  summary: string;                  // Human-readable: "Missing: size range, destination"
}

export type ConversationMode = 'fast' | 'standard' | 'expert';

export type ProductComplexity = 'simple' | 'medium' | 'complex';

export interface AssumptionRegister {
  buyer_confirmed: Array<{ field: string; value: string; label: string }>;
  ai_recommended_approved: Array<{ field: string; value: string; reason: string; label: string }>;
  ai_inferred: Array<{ field: string; value: string; reason: string; label: string }>;
  supplier_dependent: Array<{ field: string; label: string; reason?: string }>;
  unknown: Array<{ field: string; label: string; criticality: FieldCriticality }>;
  not_applicable: Array<{ field: string; label: string; reason: string }>;
}

export interface SupplierReadiness {
  can_quote: boolean;
  buyer_completeness_pct: number;
  supplier_readiness_pct: number;
  procurement_risks: string[];
  missing_critical: string[];
  unresolved_assumptions: string[];
}

// ─── Product Classification ──────────────────────────────────────────
export interface ProductClassification {
  broad_category: string;           // "Apparel & Textiles" (UI-facing)
  subcategory: string;              // "Footwear"
  product_type: string;             // "Athletic Footwear"
  schema_key: string;               // "footwear" — used to load CategorySchema
}

// ─── Synthesized Product Identity ────────────────────────────────────
export interface SynthesizedProduct {
  buyer_product_name: string;                  // Original buyer wording, never modified
  normalized_product_name: string | null;      // "12-Inch Heavy-Duty White Glossy Ceramic Restaurant Plates"
  synthesized_description: string | null;      // AI-quality natural language description
  category_path: string[] | null;              // ["Foodservice", "Tableware", "Dinnerware", "Plates", "Ceramic Plates"]
}

// ─── Missing Field Entry ─────────────────────────────────────────────
export interface MissingFieldEntry {
  field: string;
  label: string;
  status: MissingFieldStatus;
  criticality: FieldCriticality;
  reason?: string;              // "Required for accurate supplier quotation"
}

// ─── Central RFQ State ───────────────────────────────────────────────
export interface RFQState {
  version: 2;
  product: {
    name: ProvenancedField | null;
    classification: ProductClassification | null;
    intended_use: ProvenancedField | null;
    description: ProvenancedField | null;
    buyer_segment: ProvenancedField | null;
  };
  quantity: {
    required_quantity: ProvenancedField | null;   // Buyer's demand — NOT supplier MOQ
    unit: ProvenancedField | null;
    breakdown: ProvenancedField | null;
  };
  specifications: Record<string, ProvenancedField>;
  visual_intent: {
    references: VisualObservation[];
    accepted_attributes: string[];
    rejected_attributes: string[];
    compact_summary?: string;
    gate_status?: VisualGateStatus;
    confirmed_visual_url?: string;
    fingerprint_hash?: string;
    version?: number;
    generation_count?: number;
    iterations?: VisualIteration[];
  };
  manufacturing: Record<string, ProvenancedField>;
  quality: Record<string, ProvenancedField>;
  compliance: Record<string, ProvenancedField>;
  commercial: Record<string, ProvenancedField>;   // Includes supplier_moq, target_price, etc.
  logistics: Record<string, ProvenancedField>;
  packaging: Record<string, ProvenancedField>;     // NEW — separated from logistics
  special_requirements: Record<string, ProvenancedField>; // NEW — catch-all for non-standard fields
  evidence_log: FieldEvidence[];
  conflicts: RFQConflict[];
  questions_asked: string[];
  readiness: ReadinessAssessment;
  metadata?: {
    mode: ConversationMode;
    complexity: ProductComplexity;
  };
  // Synthesis output — computed, not stored in DB
  synthesized?: {
    product: SynthesizedProduct;
    section_scores: SectionReadiness[];
    missing_fields: MissingFieldEntry[];
    supplier_readiness_pct: number;
    can_supplier_quote: boolean;
    readiness_summary: string;          // "Ready for initial supplier matching" or "Needs 3 critical details"
    procurement_risks: string[];
  };
  supplier_readiness?: SupplierReadiness;
  assumption_register?: AssumptionRegister;
}
