import { RFQState } from './types';

export interface VisualFingerprint {
  category: string;
  productName: string;
  material: string;
  color: string;
  silhouette: string;
  branding: string;
  finish: string;
  structuralComponents: string[];
}

export type ProductCategoryArchetype =
  | 'apparel'
  | 'footwear'
  | 'machinery'
  | 'electronics'
  | 'medical'
  | 'furniture'
  | 'packaging'
  | 'general';

/**
 * Detect product category archetype from RFQState classification and specifications
 */
export function detectCategoryArchetype(rfqState: RFQState): ProductCategoryArchetype {
  const textToScan = [
    rfqState.product.name?.value || '',
    rfqState.product.classification?.broad_category || '',
    rfqState.product.classification?.subcategory || '',
    rfqState.product.classification?.product_type || '',
    rfqState.product.description?.value || '',
  ]
    .join(' ')
    .toLowerCase();

  if (
    textToScan.includes('shoe') ||
    textToScan.includes('footwear') ||
    textToScan.includes('sneaker') ||
    textToScan.includes('boot') ||
    textToScan.includes('runner') ||
    textToScan.includes('sandal') ||
    textToScan.includes('cleat') ||
    textToScan.includes('heel') ||
    textToScan.includes('loafer') ||
    textToScan.includes('slipper')
  ) {
    return 'footwear';
  }

  if (
    textToScan.includes('shirt') ||
    textToScan.includes('apparel') ||
    textToScan.includes('clothing') ||
    textToScan.includes('textile') ||
    textToScan.includes('garment') ||
    textToScan.includes('jacket') ||
    textToScan.includes('pants') ||
    textToScan.includes('hoodie') ||
    textToScan.includes('uniform') ||
    textToScan.includes('polo')
  ) {
    return 'apparel';
  }

  if (
    textToScan.includes('pump') ||
    textToScan.includes('machinery') ||
    textToScan.includes('motor') ||
    textToScan.includes('valve') ||
    textToScan.includes('compressor') ||
    textToScan.includes('conveyor') ||
    textToScan.includes('generator') ||
    textToScan.includes('industrial equipment') ||
    textToScan.includes('cnc') ||
    textToScan.includes('hydraulic')
  ) {
    return 'machinery';
  }

  if (
    textToScan.includes('electronic') ||
    textToScan.includes('pcb') ||
    textToScan.includes('sensor') ||
    textToScan.includes('enclosure') ||
    textToScan.includes('display') ||
    textToScan.includes('battery') ||
    textToScan.includes('circuit') ||
    textToScan.includes('iot')
  ) {
    return 'electronics';
  }

  if (
    textToScan.includes('medical') ||
    textToScan.includes('dental') ||
    textToScan.includes('hospital') ||
    textToScan.includes('surgical') ||
    (textToScan.includes('chair') && textToScan.includes('patient')) ||
    textToScan.includes('autoclave') ||
    textToScan.includes('sterilizer')
  ) {
    return 'medical';
  }

  if (
    textToScan.includes('furniture') ||
    textToScan.includes('chair') ||
    textToScan.includes('table') ||
    textToScan.includes('desk') ||
    textToScan.includes('shelf') ||
    textToScan.includes('cabinet')
  ) {
    return 'furniture';
  }

  if (
    textToScan.includes('bottle') ||
    textToScan.includes('packaging') ||
    textToScan.includes('box') ||
    textToScan.includes('container') ||
    textToScan.includes('jar') ||
    textToScan.includes('carton') ||
    textToScan.includes('tube') ||
    textToScan.includes('pouch')
  ) {
    return 'packaging';
  }

  return 'general';
}

/**
 * Extract the visual fingerprint from RFQState
 */
export function extractVisualFingerprint(rfqState: RFQState): VisualFingerprint {
  const specs = rfqState.specifications || {};
  const mfg = rfqState.manufacturing || {};

  // Fuzzy matcher scanning keys and values across specifications, manufacturing, and other sections
  const findSpec = (patterns: string[]): string => {
    const allEntries: Array<[string, any]> = [
      ...Object.entries(specs),
      ...Object.entries(mfg),
      ...Object.entries(rfqState.quality || {}),
      ...Object.entries(rfqState.special_requirements || {}),
    ];

    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase().trim();
      const cleanPattern = lowerPattern.replace(/[_\s\-\/\(\)]/g, '');

      // 1. Check keys
      for (const [key, field] of allEntries) {
        if (!field?.value || field.value === '(Pending)' || field.value === 'TBD' || field.value === 'Standard') {
          continue;
        }
        const lowerKey = key.toLowerCase().replace(/[_\s\-\/\(\)]/g, '');
        if (lowerKey.includes(cleanPattern)) {
          return String(field.value);
        }
      }

      // 2. Check field values
      for (const [, field] of allEntries) {
        if (!field?.value || field.value === '(Pending)' || field.value === 'TBD' || field.value === 'Standard') {
          continue;
        }
        const lowerVal = String(field.value).toLowerCase();
        if (lowerVal.includes(lowerPattern)) {
          return String(field.value);
        }
      }
    }
    return '';
  };

  // Inspect buyer reference image notes, observations, or compact summary
  const findInObservations = (patterns: string[]): string => {
    const refs = rfqState.visual_intent?.references || [];
    const texts: string[] = [];
    if (rfqState.visual_intent?.compact_summary) {
      texts.push(rfqState.visual_intent.compact_summary);
    }
    for (const ref of refs) {
      texts.push(...(ref.buyer_notes || []), ...(ref.observations || []), ...(ref.inferences || []));
    }
    const fullText = texts.join(' ');
    for (const p of patterns) {
      if (fullText.toLowerCase().includes(p.toLowerCase())) {
        return fullText;
      }
    }
    return '';
  };

  // Inspect product name and description text directly
  const findInProductText = (patterns: string[]): string => {
    const fullText = [
      rfqState.product.name?.value || '',
      rfqState.product.description?.value || '',
      rfqState.synthesized?.product?.synthesized_description || '',
    ].join(' ').toLowerCase();

    for (const p of patterns) {
      if (fullText.includes(p.toLowerCase())) {
        return p;
      }
    }
    return '';
  };

  const material =
    findSpec(['material', 'fabric', 'upper', 'sole', 'outsole', 'midsole', 'composition', 'construction', 'leather', 'mesh', 'foam', 'rubber', 'cotton', 'steel', 'wood', 'ceramic']) ||
    findInObservations(['material', 'fabric', 'leather', 'mesh', 'cotton', 'rubber', 'foam', 'steel', 'wood']) ||
    findInProductText(['leather', 'mesh', 'knit', 'canvas', 'cotton', 'silk', 'wool', 'rubber', 'foam', 'steel', 'wood', 'ceramic', 'denim', 'nylon', 'polyester']);

  const color =
    findSpec(['color', 'colour', 'colorway', 'shade', 'tone', 'blocking']) ||
    findInObservations(['color', 'colour', 'red', 'blue', 'green', 'black', 'white', 'coral', 'mint', 'cherry', 'burgundy', 'maroon', 'yellow', 'grey', 'gray', 'pink', 'orange', 'purple']) ||
    findInProductText(['cherry red', 'cherry', 'burgundy', 'maroon', 'red', 'black', 'white', 'blue', 'navy', 'green', 'mint', 'coral', 'yellow', 'grey', 'gray', 'purple', 'orange', 'pink', 'gold', 'silver', 'beige', 'brown']);

  const silhouette =
    findSpec(['silhouette', 'dimension', 'size', 'shape', 'cut', 'profile', 'outsole', 'cushion', 'sole', 'style']) ||
    findInObservations(['soul', 'sole', 'shape', 'cushion', 'style', 'silhouette', 'high-top', 'low-top']) ||
    findInProductText(['shoes', 'shoe', 'sneakers', 'sneaker', 'boots', 'boot', 'running shoe', 'sports shoe', 't-shirt', 'shirt', 'hoodie', 'jacket', 'coat', 'pants', 'shorts', 'dress', 'chair', 'table', 'bottle', 'bag', 'backpack']);

  const finish = findSpec(['finish', 'surface', 'coating', 'treatment', 'texture', 'polish', 'matte', 'gloss']) ||
    findInProductText(['matte', 'gloss', 'polished', 'brushed', 'textured', 'anodized']);

  const branding = findSpec(['brand', 'logo', 'label', 'embroidery', 'print', 'patch', 'tag']);

  return {
    category: detectCategoryArchetype(rfqState),
    productName: rfqState.product.name?.value || '',
    material,
    color,
    silhouette,
    branding,
    finish,
    structuralComponents: [
      findSpec(['components', 'assemblies', 'hardware', 'fasteners']),
    ].filter(Boolean),
  };
}

/**
 * Compute deterministic hash of visual fingerprint to detect material visual changes
 */
export function hashVisualFingerprint(fp: VisualFingerprint): string {
  const serialized = [
    fp.category,
    fp.productName.toLowerCase().trim(),
    fp.material.toLowerCase().trim(),
    fp.color.toLowerCase().trim(),
    fp.silhouette.toLowerCase().trim(),
    fp.branding.toLowerCase().trim(),
    fp.finish.toLowerCase().trim(),
    fp.structuralComponents.map(c => c.toLowerCase().trim()).sort().join('|'),
  ].join('::');

  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    hash = (hash << 5) - hash + serialized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if the product has sufficient visual specifications to trigger visualization
 */
export function checkVisualReadiness(rfqState: RFQState): {
  isReady: boolean;
  score: number;
  missing: string[];
} {
  const missing: string[] = [];
  const productName = rfqState.product.name?.value;
  if (!productName || productName === '(Pending)') missing.push('Product name/type');

  const fp = extractVisualFingerprint(rfqState);
  const hasRefImages = Boolean(
    (rfqState.visual_intent?.references && rfqState.visual_intent.references.length > 0) ||
    (rfqState.visual_intent?.compact_summary)
  );

  if (!fp.material && !fp.color && !fp.silhouette && !hasRefImages) {
    missing.push('Primary material, color, or reference visual');
  }

  let score = 0;
  if (productName && productName !== '(Pending)') score += 30;
  if (hasRefImages) score += 25;
  if (fp.material) score += 25;
  if (fp.color) score += 20;
  if (fp.silhouette) score += 15;
  if (fp.branding) score += 10;
  if (fp.finish) score += 10;

  return {
    isReady: score >= 50 && missing.length === 0,
    score,
    missing,
  };
}

/**
 * Build category-specific studio packshot prompt for diffusion models
 */
export function buildVisualPrompt(rfqState: RFQState): {
  prompt: string;
  negativePrompt: string;
  fingerprint: VisualFingerprint;
  fingerprintHash: string;
} {
  const fp = extractVisualFingerprint(rfqState);
  const archetype = detectCategoryArchetype(rfqState);
  const hash = hashVisualFingerprint(fp);

  const productTitle = fp.productName || 'commercial product';
  const colorSpec = fp.color ? fp.color : 'neutral standard commercial finish';
  const materialSpec = fp.material ? fp.material : 'commercial manufacturing grade';
  const brandingSpec = fp.branding
    ? `Subtle illustrative branding placement: ${fp.branding}. Clean subtle generic embroidery or print location.`
    : 'Clean blank surface, no unneeded badges.';

  let categorySpecificDirectives = '';

  switch (archetype) {
    case 'footwear':
      categorySpecificDirectives = `Professional footwear commercial catalog photography. 3/4 lateral perspective showing silhouette profile, upper construction, outsole tread, and heel-to-toe curvature. Crisp authentic ${materialSpec} textures, vibrant ${colorSpec} finish, clean defined midsole and cushion elements. Studio lighting highlighting craftsmanship and sole grip. ${brandingSpec}`;
      break;

    case 'apparel':
      categorySpecificDirectives = `Professional B2B apparel catalog photography. Invisible ghost mannequin presentation or flat-lay. Clean crisp seams, authentic ${materialSpec} weave texture, ${colorSpec} hue throughout. Perfectly pressed, neatly tailored. ${brandingSpec}`;
      break;

    case 'machinery':
      categorySpecificDirectives = `Precision industrial equipment catalog packshot. 3/4 isometric orthographic perspective. Clean ${materialSpec} construction (brushed stainless steel or industrial cast finish). Clear mechanical details: mounting flange, motor housing, intake and outlet ports, pressure gauge fitting. Clean engineering presentation. ${brandingSpec}`;
      break;

    case 'electronics':
      categorySpecificDirectives = `High-end industrial design product packshot. Matte ${materialSpec} enclosure in ${colorSpec}. Visible precision cutouts for standard I/O ports, clean beveled seams, flush status LED indicators. Technical consumer/commercial hardware render.`;
      break;

    case 'medical':
      categorySpecificDirectives = `Professional medical/dental commercial equipment packshot. Clinical ergonomic form, hygienic ${materialSpec} upholstery in ${colorSpec}, stainless-steel and medical-grade powder-coated articulated frame. Sterile, precision engineered aesthetic.`;
      break;

    case 'furniture':
      categorySpecificDirectives = `Commercial architectural furniture product photograph. Isolated single unit, ${colorSpec} finish, authentic ${materialSpec} surface grain and texture. Sturdy commercial-grade joinery and structure. Balanced natural perspective.`;
      break;

    case 'packaging':
      categorySpecificDirectives = `3D commercial packaging packshot. Clean ${materialSpec} container in ${colorSpec}, precise closures and cap threading. Clean blank labeling surface with indicated branding zone. High realism on reflections and material transparency.`;
      break;

    default:
      categorySpecificDirectives = `Isolated commercial product packshot. Clean ${materialSpec} finish in ${colorSpec}. High detail on geometric contours, functional edges, and material texture. Standard wholesale catalog photograph.`;
      break;
  }

  const prompt = [
    `Isolated commercial studio product packshot of: ${productTitle}.`,
    categorySpecificDirectives,
    `Presentation: Centered single product on a seamless solid off-white background (#F8FAFC).`,
    `Lighting: Balanced commercial 5500K soft studio illumination with subtle natural contact shadow beneath.`,
    `Quality: Crisp focus, true-to-life industrial proportions, photorealistic material rendering, no human model, no environmental clutter.`,
  ].join(' ');

  const negativePrompt = [
    'human model, face, hands, messy background, dramatic cinematic lighting, deep shadows, bokeh blur, artistic vignette',
    'distorted geometry, low resolution, blurry texture, CGI cartoon, sketch, watermark, arbitrary random text, fake certification badge',
    'room interior, outdoor scenery, cluttered workshop, dirty surfaces',
  ].join(', ');

  return {
    prompt,
    negativePrompt,
    fingerprint: fp,
    fingerprintHash: hash,
  };
}
