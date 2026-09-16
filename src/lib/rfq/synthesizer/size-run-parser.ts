import { SizeRunEntry, SizeRunMatrix } from '../types';

/**
 * Parses free-form text or structured ratio strings into a SizeRunMatrix.
 * Supports:
 * - "30x32: 525, 32x32: 1050, 34x32: 1050, 36x32: 525, 38x32: 350"
 * - "30x32 (525 pcs), 32x32 (1050 pcs)"
 * - "S: 500, M: 1000, L: 1000, XL: 500"
 * - "S-M-L-XL ratio 1:2:2:1" (distributes totalQuantity)
 */
export function parseSizeRunText(input: string, totalQuantity?: number): SizeRunMatrix | null {
  if (!input || typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  const entries: SizeRunEntry[] = [];

  // Pattern 1: Waist x Inseam or Size Name with count (e.g., "30x32: 525" or "30x32 - 525" or "30x32 (525)")
  const pairRegex = /([A-Za-z0-9/xX\.-]+)\s*[:=\-–\(]\s*(\d[\d,]*)\s*(?:pcs|units|pieces|\))?/gi;
  let match: RegExpExecArray | null;
  let foundPairs = false;

  while ((match = pairRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const rawQty = parseInt(match[2].replace(/,/g, ''), 10);

    if (!isNaN(rawQty) && rawQty > 0) {
      foundPairs = true;
      const entry: SizeRunEntry = {
        size_label: rawLabel,
        quantity: rawQty,
      };

      // Check if waist x inseam (e.g. "30x32" or "32X34")
      const wxMatch = rawLabel.match(/^(\d{2})[xX](\d{2})$/);
      if (wxMatch) {
        entry.waist = parseInt(wxMatch[1], 10);
        entry.inseam = parseInt(wxMatch[2], 10);
      }

      entries.push(entry);
    }
  }

  if (foundPairs && entries.length > 0) {
    const total = entries.reduce((acc, e) => acc + e.quantity, 0);
    return {
      entries,
      total_quantity: total,
      size_system: entries.some(e => e.waist) ? 'US' : 'Custom',
      has_pom: entries.some(e => e.waist && e.inseam),
    };
  }

  // Pattern 2: Ratios e.g. "1:2:2:1" with sizes "S, M, L, XL"
  const ratioMatch = text.match(/(\d+):(\d+)(?::(\d+))?(?::(\d+))?(?::(\d+))?/);
  if (ratioMatch && totalQuantity && totalQuantity > 0) {
    const ratioParts = ratioMatch.slice(1).filter(Boolean).map(n => parseInt(n, 10));
    const sumRatio = ratioParts.reduce((a, b) => a + b, 0);

    if (sumRatio > 0) {
      const defaultSizes = ['S', 'M', 'L', 'XL', 'XXL'];
      ratioParts.forEach((part, i) => {
        const qty = Math.round((part / sumRatio) * totalQuantity);
        entries.push({
          size_label: defaultSizes[i] || `Size ${i + 1}`,
          quantity: qty,
          ratio: part,
        });
      });

      return {
        entries,
        total_quantity: entries.reduce((acc, e) => acc + e.quantity, 0),
        size_system: 'US',
        has_pom: false,
      };
    }
  }

  return null;
}
