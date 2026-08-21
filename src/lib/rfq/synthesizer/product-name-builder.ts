import { RFQState } from '../types';

/**
 * Build a normalized, procurement-oriented product name from confirmed specs.
 * Example: "12-Inch Heavy-Duty White Glossy Ceramic Restaurant Plates"
 * 
 * Rules:
 * - Only uses CONFIRMED fields (buyer_confirmed or ai_recommendation_approved)
 * - Never invents attributes
 * - Returns null if insufficient info
 */
export function buildNormalizedProductName(state: RFQState): string | null {
  const parts: string[] = [];
  const specs = state.specifications;

  // Helper: get confirmed value
  const confirmed = (field: { value?: string | null; buyer_confirmed?: boolean; source_type?: string } | null | undefined): string | null => {
    if (!field || !field.value) return null;
    if (field.buyer_confirmed || field.source_type === 'ai_recommendation_approved') return field.value;
    return null;
  };

  // 1. Dimensions (e.g., "12-Inch")
  const dims = confirmed(specs.dimensions) || confirmed(specs.diameter);
  if (dims) parts.push(dims);

  // 2. Duty level (e.g., "Heavy-Duty")
  const duty = confirmed(specs.duty_level);
  if (duty) parts.push(duty);

  // 3. Color (e.g., "White")
  const color = confirmed(specs.color);
  if (color) parts.push(color);

  // 4. Finish (e.g., "Glossy")
  const finish = confirmed(specs.finish);
  if (finish) parts.push(finish);

  // 5. Material (e.g., "Ceramic")
  const material = confirmed(specs.material);
  if (material) parts.push(material);

  // 6. Application qualifier (e.g., "Restaurant")
  const use = confirmed(state.product.intended_use);
  if (use) {
    // Extract first meaningful word
    const useWord = use.split(/[\s/,]+/)[0];
    if (useWord && useWord.length > 2) parts.push(useWord);
  }

  // 7. Product base name
  const name = state.product.name?.value;
  if (name) {
    // Capitalize and add if not already redundant
    const baseName = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    // Avoid repeating material or other already-added words
    const existingLower = parts.map(p => p.toLowerCase());
    const nameWords = baseName.split(' ').filter(w => !existingLower.includes(w.toLowerCase()));
    if (nameWords.length > 0) parts.push(nameWords.join(' '));
  }

  if (parts.length < 2) return null; // Need at least 2 parts for a meaningful normalized name

  return parts.join(' ');
}
