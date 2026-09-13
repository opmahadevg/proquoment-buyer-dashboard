import { Evidence } from './evidence';
import { DataGap } from './data-gap';
import { CalculationRecord } from './calculation';
import { ResearchState } from './research-state';
import { SourcingObject } from './sourcing-object';

export type StructuredCardType =
  | 'intake_status'
  | 'spec_elicitation'
  | 'market_overview'
  | 'trade_analysis'
  | 'price_intelligence'
  | 'compliance_summary'
  | 'origin_comparison'
  | 'landed_cost'
  | 'supplier_landscape'
  | 'risk_assessment'
  | 'sourcing_decision'
  | 'sourcing_briefing';

export interface StructuredCard {
  id: string;
  type: StructuredCardType;
  title: string;
  data: Record<string, any>;
  evidenceIds?: string[];
  classificationSummary?: {
    observedCount: number;
    calculatedCount: number;
    inferredCount: number;
  };
}

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  actionType: 'run_deep_research' | 'compare_origins' | 'check_landed_cost' | 'generate_rfq' | 'custom_query' | 'provide_parameter';
  params?: Record<string, any>;
}

export interface RFQReadiness {
  isReady: boolean;
  score: number; // 0-100
  presentFields: string[];
  missingFields: string[];
  recommendation: string;
}

export interface IntelligenceResponse {
  sessionId: string;
  messageId: string;
  content: string;
  state: ResearchState;
  cards: StructuredCard[];
  evidence: Evidence[];
  calculations: CalculationRecord[];
  dataGaps: DataGap[];
  suggestedActions: SuggestedAction[];
  rfqReadiness?: RFQReadiness;
  sourcingObject?: SourcingObject;
}
