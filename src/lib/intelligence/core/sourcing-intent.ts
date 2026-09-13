export type ObjectiveType =
  | 'identify_product'
  | 'evaluate_market'
  | 'evaluate_source'
  | 'compare_origins'
  | 'analyze_price'
  | 'analyze_compliance'
  | 'calculate_landed_cost'
  | 'find_suppliers'
  | 'make_sourcing_decision'
  | 'prepare_rfq'
  | 'general_research';

export type ResearchDepth = 'quick' | 'standard' | 'deep';

export interface ExtractedEntities {
  product?: string;
  category?: string;
  hsCode?: string;
  destination?: string;
  candidateOrigins?: string[];
  quantity?: number;
  unit?: string;
  targetPrice?: number;
  incoterm?: string;
  specs?: Record<string, string>;
}

export type EvidenceRequirement =
  | 'product_classification'
  | 'import_demand'
  | 'import_growth'
  | 'origin_market_share'
  | 'export_strength'
  | 'observed_price'
  | 'tariff_duties'
  | 'compliance_rules'
  | 'supplier_depth'
  | 'freight_benchmark'
  | 'landed_cost';

export interface IntakeOption {
  label: string;
  value: string;
  field: 'quantity' | 'destination' | 'specifications' | 'general' | 'timeline';
}

export interface IntakeAssessment {
  isComplete: boolean;
  missingFields: ('quantity' | 'destination' | 'specifications')[];
  buyerMessage: string;
  suggestedOptions: IntakeOption[];
}

export interface IntelligenceObjective {
  objective: ObjectiveType;
  entities: ExtractedEntities;
  requiredEvidence: EvidenceRequirement[];
  depth: ResearchDepth;
  userQuery: string;
  intake?: IntakeAssessment;
}

export interface SpecElicitationResponse {
  stage: import('./conversation-state').SpecStage;
  isResearchReady: boolean;
  agentQuestion: string;
  agentRationale: string;
  suggestedOptions: IntakeOption[];
  updatedSpecs: import('./conversation-state').AccumulatedSpecs;
  cardData: {
    completedStages: import('./conversation-state').SpecStage[];
    currentStageLabel: string;
    progressPercent: number;
  };
}
