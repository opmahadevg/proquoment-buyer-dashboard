import { RFQState, ProductClassification } from '../types';

// Keyword → category path mapping
// This is extensible — add new categories by adding entries
const CATEGORY_RULES: Array<{
  keywords: string[];
  path: string[];
  schema_key: string;
}> = [
  // Foodservice & Tableware
  { keywords: ['plate', 'plates', 'dinnerware', 'tableware', 'bowl', 'bowls', 'cup', 'cups', 'mug', 'mugs', 'saucer'],
    path: ['Foodservice & Hospitality', 'Tableware', 'Dinnerware'], schema_key: 'generic' },
  // Ceramics (broader)
  { keywords: ['ceramic', 'porcelain', 'stoneware', 'earthenware', 'bone china', 'pottery'],
    path: ['Materials', 'Ceramics'], schema_key: 'generic' },
  // Apparel
  { keywords: ['shirt', 'dress', 'pants', 'jacket', 'clothing', 'garment', 'apparel', 't-shirt', 'hoodie', 'sweater'],
    path: ['Apparel & Textiles', 'Clothing'], schema_key: 'apparel' },
  // Footwear
  { keywords: ['shoe', 'shoes', 'sneaker', 'boot', 'sandal', 'footwear', 'slipper'],
    path: ['Apparel & Textiles', 'Footwear'], schema_key: 'footwear' },
  // Electronics
  { keywords: ['electronic', 'circuit', 'pcb', 'led', 'cable', 'connector', 'sensor', 'display', 'battery'],
    path: ['Electronics & Components'], schema_key: 'generic' },
  // Furniture
  { keywords: ['chair', 'table', 'desk', 'sofa', 'cabinet', 'shelf', 'furniture', 'bed', 'wardrobe'],
    path: ['Furniture & Home Furnishing'], schema_key: 'generic' },
  // Packaging
  { keywords: ['box', 'carton', 'bag', 'pouch', 'bottle', 'jar', 'container', 'packaging', 'label'],
    path: ['Packaging & Containers'], schema_key: 'generic' },
  // Jewelry
  { keywords: ['ring', 'necklace', 'bracelet', 'earring', 'pendant', 'jewelry', 'jewellery', 'gemstone'],
    path: ['Jewelry & Accessories'], schema_key: 'generic' },
  // Food & Beverage
  { keywords: ['spice', 'tea', 'coffee', 'snack', 'sauce', 'oil', 'flour', 'sugar', 'chocolate', 'food'],
    path: ['Food & Beverage'], schema_key: 'generic' },
  // Industrial
  { keywords: ['valve', 'pump', 'motor', 'bearing', 'gear', 'pipe', 'fitting', 'fastener', 'bolt', 'nut'],
    path: ['Industrial Components'], schema_key: 'generic' },
  // Beauty & Personal Care
  { keywords: ['cosmetic', 'skincare', 'shampoo', 'soap', 'perfume', 'cream', 'lotion', 'beauty'],
    path: ['Beauty & Personal Care'], schema_key: 'generic' },
];

/**
 * Auto-classify product category from available state.
 * Returns null if insufficient information for confident classification.
 * Safe inference only — never guesses.
 */
export function classifyCategory(state: RFQState): ProductClassification | null {
  // If buyer already provided classification, preserve it
  if (state.product.classification && state.product.classification.broad_category !== 'Unknown') {
    return state.product.classification;
  }

  // Build search text from all available product info
  const searchParts: string[] = [];
  if (state.product.name?.value) searchParts.push(state.product.name.value);
  if (state.product.intended_use?.value) searchParts.push(state.product.intended_use.value);
  if (state.product.description?.value) searchParts.push(state.product.description.value);
  if (state.specifications.material?.value) searchParts.push(state.specifications.material.value);

  const searchText = searchParts.join(' ').toLowerCase();
  if (!searchText.trim()) return null;

  // Score each rule by keyword match count
  let bestMatch: typeof CATEGORY_RULES[0] | null = null;
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    const score = rule.keywords.filter(kw => searchText.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (!bestMatch || bestScore === 0) return null;

  // Build specific product type from name
  const productName = state.product.name?.value || '';
  const materialName = state.specifications.material?.value || '';

  // Build full path: base path + specific product
  const fullPath = [...bestMatch.path];
  if (materialName && !fullPath.some(p => p.toLowerCase().includes(materialName.toLowerCase()))) {
    fullPath.push(`${materialName} Products`);
  }

  return {
    broad_category: bestMatch.path[0],
    subcategory: bestMatch.path[1] || bestMatch.path[0],
    product_type: bestMatch.path[bestMatch.path.length - 1],
    schema_key: bestMatch.schema_key,
  };
}

/**
 * Build hierarchical category path for display.
 */
export function buildCategoryPath(state: RFQState): string[] | null {
  const classification = state.product.classification || classifyCategory(state);
  if (!classification) return null;

  const path = [classification.broad_category];
  if (classification.subcategory && classification.subcategory !== classification.broad_category) {
    path.push(classification.subcategory);
  }
  if (classification.product_type && classification.product_type !== classification.subcategory) {
    path.push(classification.product_type);
  }

  // Add specific material if known
  const material = state.specifications.material?.value;
  if (material) {
    const lastSegment = path[path.length - 1].toLowerCase();
    if (!lastSegment.includes(material.toLowerCase())) {
      path.push(`${material} ${state.product.name?.value || 'Products'}`);
    }
  }

  return path;
}
