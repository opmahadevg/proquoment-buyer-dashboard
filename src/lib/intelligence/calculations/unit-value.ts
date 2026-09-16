import { CalculationResult } from '../core/calculation';

export function calculateTradeUnitValue(
  tradeValueUSD: number,
  quantityOrWeight: number,
  unitLabel: string = 'MT',
  productCategory?: string
): CalculationResult<number> {
  const formula = 'tradeValueUSD / quantityOrWeight';
  const inputs = { tradeValueUSD, quantityOrWeight, unitLabel, productCategory };

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

  const isDiscrete = ['apparel', 'textile', 'clothing', 'garment', 'denim', 'jeans', 'footwear', 'shoes', 'mug']
    .some((cat) => (productCategory || '').toLowerCase().includes(cat));

  const explanation = isDiscrete && (unitLabel === 'MT' || unitLabel === 'KG')
    ? `Observed customs trade unit value: $${rounded.toLocaleString()} USD/${unitLabel}. (Customs bulk basis — see per-piece normalization for garment unit pricing).`
    : `Observed trade unit value: $${rounded.toLocaleString()} USD/${unitLabel}`;

  return {
    result: rounded,
    formula,
    inputs,
    explanation,
  };
}
