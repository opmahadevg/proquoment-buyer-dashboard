/**
 * Normalize display values while preserving originals.
 * Returns { normalized, display } where display = "12 in (304.8 mm)"
 */
export interface NormalizedValue {
  original: string;
  normalized: string;
  display: string;
}

const INCH_TO_MM = 25.4;

/**
 * Normalize a dimension value to mm while showing both.
 */
export function normalizeDimension(value: string): NormalizedValue {
  const original = value.trim();

  // Match patterns like: 12-inch, 12", 12 in, 12 inches
  const inchMatch = original.match(/(\d+(?:\.\d+)?)\s*(?:-?\s*(?:inch(?:es)?|in\b|"))/i);
  if (inchMatch) {
    const inches = parseFloat(inchMatch[1]);
    const mm = Math.round(inches * INCH_TO_MM * 10) / 10;
    return {
      original,
      normalized: `${mm} mm`,
      display: `${inches} in (${mm} mm)`,
    };
  }

  // Match cm
  const cmMatch = original.match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (cmMatch) {
    const cm = parseFloat(cmMatch[1]);
    const mm = cm * 10;
    return {
      original,
      normalized: `${mm} mm`,
      display: `${cm} cm (${mm} mm)`,
    };
  }

  return { original, normalized: original, display: original };
}

/**
 * Normalize quantity strings to clean numeric format.
 * "5k" → "5,000", "5000" → "5,000"
 */
export function normalizeQuantity(value: string): NormalizedValue {
  const original = value.trim();
  let num: number;

  // Handle "5k", "10K"
  const kMatch = original.match(/^(\d+(?:\.\d+)?)\s*k$/i);
  if (kMatch) {
    num = parseFloat(kMatch[1]) * 1000;
  } else {
    num = parseInt(original.replace(/[^0-9]/g, ''), 10);
  }

  if (isNaN(num)) {
    return { original, normalized: original, display: original };
  }

  const formatted = num.toLocaleString('en-US');
  return {
    original,
    normalized: String(num),
    display: `${formatted} units`,
  };
}

/**
 * Normalize weight to grams.
 */
export function normalizeWeight(value: string): NormalizedValue {
  const original = value.trim();

  const kgMatch = original.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (kgMatch) {
    const kg = parseFloat(kgMatch[1]);
    const g = kg * 1000;
    return { original, normalized: `${g} g`, display: `${kg} kg (${g} g)` };
  }

  const lbMatch = original.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)/i);
  if (lbMatch) {
    const lb = parseFloat(lbMatch[1]);
    const g = Math.round(lb * 453.592);
    return { original, normalized: `${g} g`, display: `${lb} lb (${g} g)` };
  }

  return { original, normalized: original, display: original };
}
