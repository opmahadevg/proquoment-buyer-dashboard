import { CalculationResult } from '../core/calculation';

export interface RawPricePoint {
  value: number;
  currency: string;
  unit: string; // e.g. "MT", "KG", "LB", "TON"
  incoterm?: string; // "FOB", "CIF", "EXW", "DDP"
  originCountry?: string;
  destinationCountry?: string;
}

export interface NormalizedPricePoint {
  valueUSDPerMT: number;
  originalPrice: RawPricePoint;
  currencyConversionRateToUSD: number;
  unitConversionFactorToMT: number;
  normalizedBasis: string;
}

// Approximate static conversions for V1
const UNIT_TO_MT_MULTIPLIERS: Record<string, number> = {
  MT: 1,
  METRIC_TON: 1,
  TON: 1,
  KG: 0.001,
  KILOGRAM: 0.001,
  G: 0.000001,
  LB: 0.000453592,
  LBS: 0.000453592,
  POUND: 0.000453592,
  QUINTAL: 0.1,
};

const FX_TO_USD_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 0.0116,
  CNY: 0.138,
  EUR: 1.08,
  GBP: 1.28,
  IDR: 0.000062,
  AED: 0.272,
  SGD: 0.74,
};

export function normalizePrice(raw: RawPricePoint): CalculationResult<NormalizedPricePoint> {
  const formula = '(value * fxRateToUSD) / unitToMT';
  const currencyKey = raw.currency.toUpperCase();
  const unitKey = raw.unit.toUpperCase();

  const fxRate = FX_TO_USD_RATES[currencyKey] ?? 1.0;
  const unitFactor = UNIT_TO_MT_MULTIPLIERS[unitKey] ?? 1.0;

  const valueInUSD = raw.value * fxRate;
  const valuePerMT = unitFactor > 0 ? valueInUSD / unitFactor : valueInUSD;
  const rounded = Math.round(valuePerMT * 100) / 100;

  return {
    result: {
      valueUSDPerMT: rounded,
      originalPrice: raw,
      currencyConversionRateToUSD: fxRate,
      unitConversionFactorToMT: unitFactor,
      normalizedBasis: `${raw.incoterm || 'FOB'} in USD/MT`,
    },
    formula,
    inputs: { raw, fxRate, unitFactor },
    explanation: `Normalized ${raw.currency} ${raw.value}/${raw.unit} to $${rounded.toLocaleString()} USD/MT`,
  };
}
