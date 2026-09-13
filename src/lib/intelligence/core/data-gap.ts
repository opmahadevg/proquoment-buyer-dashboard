export type DataGapCategory =
  | 'product'
  | 'trade'
  | 'price'
  | 'supplier'
  | 'compliance'
  | 'logistics'
  | 'commercial';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

export interface DataGap {
  id: string;
  category: DataGapCategory;
  description: string;
  importance: ImportanceLevel;
  recommendedAction?: string;
  createdAt?: string;
}

export interface Assumption {
  id: string;
  category: string;
  statement: string;
  rationale: string;
  impactIfInvalid: string;
  confidence: 'high' | 'medium' | 'low';
}
