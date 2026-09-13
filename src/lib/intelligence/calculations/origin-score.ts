import { CalculationResult } from '../core/calculation';
import { OriginRecommendation } from '../core/decision-context';
import { calculateSourcingScore, SourcingScoreInput } from './sourcing-score';

export interface OriginComparisonInput {
  destinationCountry: string;
  origins: {
    countryCode: string;
    countryName: string;
    metrics: SourcingScoreInput;
    strengths: string[];
    challenges: string[];
    landedCostUSD?: number;
    recommendedSuppliers?: string[];
  }[];
}

export function compareOrigins(
  input: OriginComparisonInput
): CalculationResult<OriginRecommendation[]> {
  const formula = 'Rank origins by calculated deterministic sourcing score descending';

  const scoredOrigins = input.origins.map((origin) => {
    const scoreRes = calculateSourcingScore(origin.metrics);
    return {
      countryCode: origin.countryCode,
      countryName: origin.countryName,
      score: scoreRes.result,
      landedCostEstimateUSD: origin.landedCostUSD,
      strengths: origin.strengths,
      challenges: origin.challenges,
      recommendedSuppliers: origin.recommendedSuppliers,
      confidence: (scoreRes.result.total > 70 ? 'high' : scoreRes.result.total > 45 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    };
  });

  // Sort descending by score total
  scoredOrigins.sort((a, b) => b.score.total - a.score.total);

  const ranked: OriginRecommendation[] = scoredOrigins.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  return {
    result: ranked,
    formula,
    inputs: { destinationCountry: input.destinationCountry, candidateCount: input.origins.length },
    explanation: `Ranked ${ranked.length} candidate sourcing origins for destination ${input.destinationCountry}`,
  };
}
