import { RFQState, ProvenancedField } from '../types';

/**
 * Generate a natural-language product description from confirmed requirements.
 * 
 * Rules:
 * - Only describes confirmed/extracted information
 * - Never invents requirements (no "dishwasher-safe" unless confirmed)
 * - Reads naturally and professionally
 * - Updates as new info becomes available
 */
export function generateDescription(state: RFQState): string | null {
  const confirmedParts: string[] = [];
  const specs = state.specifications;

  // Helper: value if confirmed
  const val = (f: ProvenancedField | null | undefined): string | null => {
    if (!f || !f.value) return null;
    return f.value;
  };

  const material = val(specs.material);
  const color = val(specs.color);
  const finish = val(specs.finish);
  const name = val(state.product.name);
  const use = val(state.product.intended_use);
  const dims = val(specs.dimensions) || val(specs.diameter);
  const weight = val(specs.weight);
  const duty = val(specs.duty_level);
  const branding = val(specs.branding_required);

  // Need at least product name + one spec to generate
  if (!name) return null;

  // Build sentence
  let desc = '';

  // Opening: [Color] [finish] [material] [product name]
  const opening: string[] = [];
  if (color) opening.push(color);
  if (finish) opening.push(finish.toLowerCase());
  if (material) opening.push(material.toLowerCase());
  opening.push(name.toLowerCase());
  desc = opening.join(' ');

  // Make first letter uppercase
  desc = desc.charAt(0).toUpperCase() + desc.slice(1);

  // Purpose clause
  if (use || duty) {
    const purposeParts: string[] = [];
    if (duty) purposeParts.push(`${duty.toLowerCase()}`);
    if (use) purposeParts.push(`${use.toLowerCase()} use`);
    desc += ` designed for ${purposeParts.join(', ')}`;
  }

  // Dimensions
  if (dims) {
    desc += `, with a ${dims} ${dims.includes('diameter') ? '' : 'size'}`.replace(/\s+/g, ' ').trim();
  }

  // Weight
  if (weight) {
    desc += ` and ${weight.includes('per') ? '' : 'a '}target weight of ${weight}`;
    if (!weight.toLowerCase().includes('per')) desc += ' per unit';
  }

  desc += '.';

  // Branding statement
  if (branding && branding.toLowerCase().includes('no')) {
    desc += ' No branding or logo is required.';
  }

  // Quantity context
  const qty = val(state.quantity.required_quantity) || val((state.quantity as any).value);
  if (qty) {
    desc += ` Order quantity: ${qty} units.`;
  }

  return desc.length > 20 ? desc : null;
}
