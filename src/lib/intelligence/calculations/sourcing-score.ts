import { CalculationResult } from '../core/calculation';
import { ScoreFactor, SourcingScore } from '../core/decision-context';

export interface SourcingScoreInput {
  demandAttractiveness: number; // 0 - 100
  importDependency: number; // 0 - 100
  originCompetitiveness: number; // 0 - 100
  priceCompetitiveness: number; // 0 - 100 (based on observed historical unit values)
  supplierDepth: number; // 0 - 100
  tradeGrowth: number; // 0 - 100
  complianceFeasibility: number; // 0 - 100
  logisticsEfficiency: number; // 0 - 100
  evidenceMap?: Record<string, string[]>;
}

export const DEFAULT_SOURCING_WEIGHTS = {
  demandAttractiveness: 0.20,
  importDependency: 0.15,
  originCompetitiveness: 0.20,
  priceCompetitiveness: 0.15,
  supplierDepth: 0.10,
  tradeGrowth: 0.10,
  complianceFeasibility: 0.05,
  logisticsEfficiency: 0.05,
};

export function calculateSourcingScore(
  input: SourcingScoreInput,
  customWeights?: Partial<typeof DEFAULT_SOURCING_WEIGHTS>
): CalculationResult<SourcingScore> {
  const weights = { ...DEFAULT_SOURCING_WEIGHTS, ...customWeights };
  const evidenceMap = input.evidenceMap || {};

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const factorDefs: { key: keyof typeof DEFAULT_SOURCING_WEIGHTS; name: string; val: number }[] = [
    { key: 'demandAttractiveness', name: 'Demand Attractiveness', val: clamp(input.demandAttractiveness) },
    { key: 'importDependency', name: 'Import Dependency', val: clamp(input.importDependency) },
    { key: 'originCompetitiveness', name: 'Origin Competitiveness', val: clamp(input.originCompetitiveness) },
    { key: 'priceCompetitiveness', name: 'Price Competitiveness', val: clamp(input.priceCompetitiveness) },
    { key: 'supplierDepth', name: 'Supplier Depth', val: clamp(input.supplierDepth) },
    { key: 'tradeGrowth', name: 'Trade Growth (YoY/CAGR)', val: clamp(input.tradeGrowth) },
    { key: 'complianceFeasibility', name: 'Compliance Feasibility', val: clamp(input.complianceFeasibility) },
    { key: 'logisticsEfficiency', name: 'Logistics & Transit Efficiency', val: clamp(input.logisticsEfficiency) },
  ];

  let totalScore = 0;
  const factors: ScoreFactor[] = factorDefs.map(({ key, name, val }) => {
    const weight = weights[key];
    const contribution = Math.round(val * weight * 10) / 10;
    totalScore += contribution;

    return {
      name,
      score: val,
      weight,
      contribution,
      evidenceIds: evidenceMap[key] || [],
    };
  });

  const roundedTotal = Math.max(0, Math.min(100, Math.round(totalScore)));

  const methodology =
    'Deterministic weighted sum of 8 procurement factors: Demand (20%), Origin (20%), Import Dependency (15%), Price (15%), Supplier Depth (10%), Trade Growth (10%), Compliance (5%), Logistics (5%).';

  const formula = 'SUM(factorScore_i * weight_i)';

  return {
    result: {
      total: roundedTotal,
      factors,
      methodology,
    },
    formula,
    inputs: { ...input, weights },
    explanation: `Calculated sourcing score of ${roundedTotal}/100 based on verified procurement factors.`,
  };
}
