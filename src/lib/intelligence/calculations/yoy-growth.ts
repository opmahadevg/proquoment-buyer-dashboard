import { CalculationResult } from '../core/calculation';

export function calculateYoYGrowth(
  currentPeriodValue: number,
  previousPeriodValue: number
): CalculationResult<number> {
  const formula = '((currentPeriodValue - previousPeriodValue) / previousPeriodValue) * 100';
  const inputs = { currentPeriodValue, previousPeriodValue };

  if (previousPeriodValue === 0) {
    return {
      result: 0,
      formula,
      inputs,
      explanation: 'YoY Growth cannot divide by zero base period',
    };
  }

  const growth = ((currentPeriodValue - previousPeriodValue) / Math.abs(previousPeriodValue)) * 100;
  const rounded = Math.round(growth * 100) / 100;

  return {
    result: rounded,
    formula,
    inputs,
    explanation: `Year-over-Year growth of ${rounded}%`,
  };
}
