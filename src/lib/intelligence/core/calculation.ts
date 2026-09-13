export interface CalculationRecord {
  id: string;
  metric: string;
  formula: string;
  inputs: Record<string, unknown>;
  result: unknown;
  evidenceIds?: string[];
  calculatedAt: string;
}

export interface CalculationResult<T = number> {
  result: T;
  formula: string;
  inputs: Record<string, unknown>;
  explanation?: string;
}
