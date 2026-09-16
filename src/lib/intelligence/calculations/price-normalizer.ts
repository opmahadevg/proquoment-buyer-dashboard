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

export interface PerPieceConversion {
  pricePerPieceUSD: number;
  categoryKey: string;
  weightPerPieceKG: number;
  pricePerMT_USD: number;
  conversionNote: string;
}

export const CATEGORY_UNIT_WEIGHTS_KG: Record<string, number> = {
  denim_jeans: 0.85,
  jeans: 0.85,
  denim: 0.85,
  trouser: 0.60,
  pants: 0.60,
  denim_jacket: 1.10,
  jacket: 0.90,
  outerwear: 1.00,
  t_shirt: 0.20,
  shirt: 0.25,
  polo: 0.25,
  sweater: 0.45,
  hoodie: 0.65,
  dress: 0.35,
  shorts: 0.35,
  blanket: 1.50,
  towel: 0.45,
  bed_sheet: 0.65,
  ceramic_mug: 0.38,
  dinner_plate: 0.55,
  tote_bag: 0.28,
  phone_case: 0.04,
  shoes: 0.95,
  footwear: 0.95,
};

export function normalizeToPerPiece(
  pricePerMT: number,
  productNameOrCategory: string
): PerPieceConversion | null {
  const q = productNameOrCategory.toLowerCase();
  let matchedKey: string | null = null;
  let weightKG = 0;

  for (const [key, w] of Object.entries(CATEGORY_UNIT_WEIGHTS_KG)) {
    if (q.includes(key.replace('_', ' ')) || q.includes(key)) {
      matchedKey = key;
      weightKG = w;
      break;
    }
  }

  if (!matchedKey || weightKG <= 0) return null;

  const rawCost = (pricePerMT / 1000) * weightKG;
  const pricePerPiece = Math.round(rawCost * 100) / 100;

  return {
    pricePerPieceUSD: pricePerPiece,
    categoryKey: matchedKey,
    weightPerPieceKG: weightKG,
    pricePerMT_USD: pricePerMT,
    conversionNote: `Calculated from bulk customs rate ($${pricePerMT.toLocaleString()}/MT) using average unit weight of ${weightKG} kg/piece.`,
  };
}

