import { CalculationResult } from '../core/calculation';

export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): CalculationResult<number> {
  const formula = '((endValue / startValue) ^ (1 / years) - 1) * 100';
  const inputs = { startValue, endValue, years };

  if (startValue <= 0 || endValue <= 0 || years <= 0) {
    return {
      result: 0,
      formula,
      inputs,
      explanation: 'CAGR undefined for non-positive values or non-positive year duration',
    };
  }

  const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  const rounded = Math.round(cagr * 100) / 100;

  return {
    result: rounded,
    formula,
    inputs,
    explanation: `Compound Annual Growth Rate over ${years} years from ${startValue.toLocaleString()} to ${endValue.toLocaleString()}`,
  };
}
