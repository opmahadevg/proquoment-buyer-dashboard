import { ProductComplexity, RFQState } from './types';

export function classifyComplexity(state: RFQState): {
  complexity: ProductComplexity;
  recommendedDepth: number;
} {
  let score = 0;
  
  // 1. Category impact
  const cat = state.product.classification?.schema_key || 'generic';
  if (['electronics', 'medical', 'food'].includes(cat)) {
    score += 3;
  }
  
  // 2. Customization presence
  if (state.specifications['branding_required']?.value === 'yes') {
    score += 1;
  }
  if (state.specifications['decoration_method']?.value) {
    score += 1;
  }
  
  // 3. Compliance requirements
  if (state.compliance['food_contact']?.value === 'yes') {
    score += 2;
  }
  
  // 4. Volume/Value heuristics
  if (state.quantity.required_quantity?.value && state.quantity.required_quantity.value.toString().toLowerCase().includes('sample')) {
    score += 1;
  }
  const qtyStr = state.quantity.required_quantity?.value || '0';
  const qty = parseInt(qtyStr.replace(/[^0-9]/g, ''), 10) || 0;
  if (qty > 10000) {
    score += 1;
  }
  
  if (score >= 4) {
    return { complexity: 'complex', recommendedDepth: 20 };
  } else if (score >= 2) {
    return { complexity: 'medium', recommendedDepth: 12 };
  } else {
    return { complexity: 'simple', recommendedDepth: 6 };
  }
}
