import { RFQState, SectionReadiness } from '../types';
import { classifyCategory, buildCategoryPath } from './category-classifier';
import { buildNormalizedProductName } from './product-name-builder';
import { generateDescription } from './description-generator';
import { resolveDependencies } from './dependency-resolver';
import { classifyMissingFields } from './missing-classifier';
import { evaluateFieldCriticality } from './field-criticality';
import { buildAssumptionRegister } from './assumption-builder';
import { getSchemaForCategory } from '../schemas';

/**
 * Main synthesis pipeline. Runs after every state update.
 * Pure function: RFQState → RFQState (with .synthesized populated)
 * 
 * Pipeline:
 * 1. Auto-classify category
 * 2. Resolve field dependencies (N/A cascading)
 * 3. Generate normalized product name
 * 4. Generate product description
 * 5. Classify missing fields
 * 6. Calculate per-section readiness
 * 7. Calculate overall supplier readiness
 */
export function synthesizeRFQ(state: RFQState): RFQState {
  let enriched = { ...state };

  // 1. Auto-classify category if not already set
  if (!enriched.product.classification || enriched.product.classification.broad_category === 'Unknown') {
    const classified = classifyCategory(enriched);
    if (classified) {
      enriched = {
        ...enriched,
        product: { ...enriched.product, classification: classified },
      };
    }
  }

  // 2. Resolve dependencies (N/A cascading)
  enriched = resolveDependencies(enriched);

  // 3. Build synthesis output
  const buyerName = enriched.product.name?.value || '';
  const normalizedName = buildNormalizedProductName(enriched);
  const description = generateDescription(enriched);
  const categoryPath = buildCategoryPath(enriched);
  const missingFields = classifyMissingFields(enriched);
  const sectionScores = calculateSectionScores(enriched);
  const assumptionRegister = buildAssumptionRegister(enriched);

  // 4. Calculate overall readiness
  const criticalMissing = missingFields.filter(f => f.status === 'critical_missing');
  const totalWeight = sectionScores.reduce((sum, s) => sum + s.weight, 0);
  const weightedScore = totalWeight > 0
    ? Math.round(sectionScores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight)
    : 0;

  const canQuote = criticalMissing.length <= 1; // Allow 1 critical missing
  const risks: string[] = [];

  // Check specific procurement risks
  const getVal = (key: string): string | null => {
    const parts = key.split('.');
    if (parts.length === 2) {
      return ((enriched as any)[parts[0]])?.[parts[1]]?.value || null;
    }
    return null;
  };

  if (!getVal('logistics.origin_country')) {
    risks.push('Origin country unknown — freight costs cannot be accurately estimated');
  }
  if (!getVal('logistics.destination_country')) {
    risks.push('Destination country unknown — compliance and logistics cannot be determined');
  }
  if (enriched.conflicts.some(c => !c.resolved)) {
    risks.push('Unresolved conflicting information exists');
  }

  // Build readiness summary
  let readinessSummary: string;
  if (criticalMissing.length === 0) {
    readinessSummary = 'Ready for supplier quotation';
  } else if (criticalMissing.length <= 2) {
    readinessSummary = `Needs ${criticalMissing.length} critical detail${criticalMissing.length > 1 ? 's' : ''}`;
  } else {
    readinessSummary = `${criticalMissing.length} important details still needed`;
  }

  enriched.synthesized = {
    product: {
      buyer_product_name: buyerName,
      normalized_product_name: normalizedName,
      synthesized_description: description,
      category_path: categoryPath,
    },
    section_scores: sectionScores,
    missing_fields: missingFields,
    supplier_readiness_pct: weightedScore,
    can_supplier_quote: canQuote,
    readiness_summary: readinessSummary,
    procurement_risks: risks,
  };

  enriched.assumption_register = assumptionRegister;

  return enriched;
}

/**
 * Calculate per-section readiness scores with dynamic weighting.
 */
function calculateSectionScores(state: RFQState): SectionReadiness[] {
  const schemaKey = state.product.classification?.schema_key || 'generic';
  const schema = getSchemaForCategory(schemaKey);
  const criticalities = evaluateFieldCriticality(state);

  const sections: Record<string, { label: string; total: number; filled: number; critical: string[]; recommended: string[]; weight: number }> = {
    intent: { label: 'Product Overview', total: 0, filled: 0, critical: [], recommended: [], weight: 1.0 },
    specification: { label: 'Technical Specifications', total: 0, filled: 0, critical: [], recommended: [], weight: 0.9 },
    customization: { label: 'Customization', total: 0, filled: 0, critical: [], recommended: [], weight: 0.3 },
    compliance: { label: 'Quality & Compliance', total: 0, filled: 0, critical: [], recommended: [], weight: 0.7 },
    quality: { label: 'Quality & Compliance', total: 0, filled: 0, critical: [], recommended: [], weight: 0.7 },
    commercial: { label: 'Commercial', total: 0, filled: 0, critical: [], recommended: [], weight: 0.8 },
    logistics: { label: 'Logistics & Delivery', total: 0, filled: 0, critical: [], recommended: [], weight: 0.7 },
    packaging: { label: 'Packaging', total: 0, filled: 0, critical: [], recommended: [], weight: 0.4 },
  };

  const getVal = (key: string): string | null => {
    const parts = key.split('.');
    if (parts.length === 2) {
      const f = ((state as any)[parts[0]])?.[parts[1]];
      return f?.value && f.value !== 'Not Applicable' ? f.value : null;
    }
    return null;
  };

  for (const [fieldKey, def] of Object.entries(schema.fields)) {
    const layer = def.layer || 'specification';
    const section = sections[layer];
    if (!section) continue;

    // Skip supplier-side fields from buyer completion scoring
    if (def.buyer_side === false) continue;

    const crit = criticalities[fieldKey];
    if (crit === 'not_applicable') continue;

    section.total++;
    const hasValue = !!getVal(fieldKey);

    if (hasValue) {
      section.filled++;
    } else {
      if (crit === 'critical' || crit === 'high') {
        section.critical.push(def.label);
      } else if (def.requirement === 'recommended') {
        section.recommended.push(def.label);
      }
    }
  }

  // Dynamic weight adjustments
  // If no branding required, reduce customization weight
  const brandingVal = state.specifications.branding_required?.value?.toLowerCase();
  if (brandingVal === 'no') {
    sections.customization.weight = 0.05;
  }

  // Merge quality + compliance into one
  const combined = {
    label: 'Quality & Compliance',
    total: sections.quality.total + sections.compliance.total,
    filled: sections.quality.filled + sections.compliance.filled,
    critical: [...sections.quality.critical, ...sections.compliance.critical],
    recommended: [...sections.quality.recommended, ...sections.compliance.recommended],
    weight: 0.7,
  };

  const finalSections: SectionReadiness[] = [];
  for (const [key, sec] of Object.entries(sections)) {
    if (key === 'quality' || key === 'compliance') continue; // merged
    finalSections.push({
      section: key,
      label: sec.label,
      score: sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 100,
      weight: sec.weight,
      total_fields: sec.total,
      filled_fields: sec.filled,
      critical_missing: sec.critical,
      recommended_missing: sec.recommended,
    });
  }

  // Add merged quality/compliance
  finalSections.push({
    section: 'quality_compliance',
    label: combined.label,
    score: combined.total > 0 ? Math.round((combined.filled / combined.total) * 100) : 100,
    weight: combined.weight,
    total_fields: combined.total,
    filled_fields: combined.filled,
    critical_missing: combined.critical,
    recommended_missing: combined.recommended,
  });

  return finalSections;
}

// Re-export sub-modules
export { classifyCategory, buildCategoryPath } from './category-classifier';
export { buildNormalizedProductName } from './product-name-builder';
export { generateDescription } from './description-generator';
export { resolveDependencies } from './dependency-resolver';
export { classifyMissingFields } from './missing-classifier';
export { evaluateFieldCriticality } from './field-criticality';
