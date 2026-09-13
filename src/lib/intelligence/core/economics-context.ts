import { EvidenceClassification } from './evidence';

export interface PriceRange {
  low: number;
  high: number;
  unit: string; // e.g. "USD/MT"
  basis?: string; // e.g. "FOB India", "CIF Jakarta"
  date?: string; // timestamp or data period
  classification: EvidenceClassification;
  evidenceIds: string[];
}

export interface CostRange {
  amountMin: number;
  amountMax: number;
  currency: string;
  basis?: string;
  notes?: string;
  evidenceIds?: string[];
}

export interface EconomicsContext {
  observedTradeUnitValues?: PriceRange; // from customs data (UN Comtrade)
  supplierQuoteRange?: PriceRange; // from internal Proquoment historical RFQs
  commodityBenchmark?: PriceRange; // World Bank monthly index if applicable
  // Note: Live price estimations and predictive targets are intentionally excluded in V1
  freight?: CostRange;
  duty?: CostRange;
  insurance?: CostRange;
  handling?: CostRange;
  landedCost?: CostRange; // derived from observed historical unit values + logistics
  currency?: string;
}
