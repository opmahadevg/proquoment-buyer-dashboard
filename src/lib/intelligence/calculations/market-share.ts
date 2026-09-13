import { CalculationResult } from '../core/calculation';

export interface MarketShareEntry {
  partner: string;
  value: number;
  sharePercent: number;
}

export function calculateMarketShare(
  partnerValues: { partner: string; value: number }[]
): CalculationResult<MarketShareEntry[]> {
  const formula = '(partnerValue / totalMarketValue) * 100';
  const total = partnerValues.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0);

  if (total <= 0) {
    return {
      result: partnerValues.map((p) => ({ partner: p.partner, value: p.value, sharePercent: 0 })),
      formula,
      inputs: { partnerValues, total },
      explanation: 'Total market volume/value is zero',
    };
  }

  const result: MarketShareEntry[] = partnerValues
    .map((item) => {
      const share = (item.value / total) * 100;
      return {
        partner: item.partner,
        value: item.value,
        sharePercent: Math.round(share * 100) / 100,
      };
    })
    .sort((a, b) => b.sharePercent - a.sharePercent);

  return {
    result,
    formula,
    inputs: { totalValue: total, partnerCount: partnerValues.length },
    explanation: `Calculated market shares across ${partnerValues.length} partners totaling ${total.toLocaleString()}`,
  };
}
