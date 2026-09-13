export type SourceType =
  | 'official'
  | 'transactional'
  | 'commercial'
  | 'company-provided'
  | 'secondary'
  | 'ai-search';

export type EvidenceClassification =
  | 'observed'
  | 'calculated'
  | 'ai-inference';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface IntelligenceSource {
  id: string;
  name: string;
  publisher?: string;
  type: SourceType;
  url?: string;
  publishedAt?: string;
  retrievedAt: string;
  dataPeriod?: string;
  license?: string;
}

export interface Evidence {
  id: string;
  claim: string;
  sourceId: string;
  value?: unknown;
  unit?: string;
  classification: EvidenceClassification;
  confidence: ConfidenceLevel;
  methodology?: string;
  observedAt?: string;
  createdAt: string;
}

export interface EvidenceReference {
  evidenceId: string;
  claimSnippet: string;
  classification: EvidenceClassification;
  sourceName: string;
}
