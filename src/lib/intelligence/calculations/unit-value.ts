import { CalculationResult } from '../core/calculation';

export function calculateTradeUnitValue(
  tradeValueUSD: number,
  quantityOrWeight: number,
  unitLabel: string = 'MT'
): CalculationResult<number> {
  const formula = 'tradeValueUSD / quantityOrWeight';
  const inputs = { tradeValueUSD, quantityOrWeight, unitLabel };

  if (quantityOrWeight <= 0 || tradeValueUSD <= 0) {
    return {
      result: 0,
      formula,
      inputs,
      explanation: 'Quantity or value is zero/invalid',
    };
  }

  const unitVal = tradeValueUSD / quantityOrWeight;
  const rounded = Math.round(unitVal * 100) / 100;

  return {
    result: rounded,
    formula,
    inputs,
    explanation: `Observed trade unit value: $${rounded.toLocaleString()} USD/${unitLabel}`,
  };
}
