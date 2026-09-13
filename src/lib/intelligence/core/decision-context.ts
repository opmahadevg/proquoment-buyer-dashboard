import { PriceRange } from './economics-context';

export interface ScoreFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0.0 - 1.0
  contribution: number; // score * weight
  evidenceIds: string[];
}

export interface SourcingScore {
  total: number; // 0 - 100
  factors: ScoreFactor[];
  methodology: string;
}

export interface OriginRecommendation {
  countryCode: string;
  countryName: string;
  rank: number;
  score: SourcingScore;
  landedCostEstimateUSD?: number;
  strengths: string[];
  challenges: string[];
  recommendedSuppliers?: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface DecisionContext {
  recommendation:
    | 'strongly_recommended'
    | 'recommended'
    | 'conditional'
    | 'not_recommended'
    | 'insufficient_data';
  recommendedOrigins: OriginRecommendation[];
  expectedLandedCost?: PriceRange; // based on historical observed unit values + freight
  keyAdvantages: string[];
  keyRisks: string[];
  criticalUnknowns: string[];
  score: SourcingScore;
  evidenceIds: string[];
  nextSteps: string[];
}
