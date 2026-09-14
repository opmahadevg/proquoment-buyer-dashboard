/**
 * AI Suggest Defaults Engine for Proquoment AI Intelligence
 * 
 * Provides market-grounded, product-aware default suggestions when buyers
 * lack specific technical, packaging, compliance, or shipment data.
 * Tone: Natural trade advisor & brainstorming partner — practical market norms,
 * not heavy regulatory jargon dumps.
 */

export interface FieldSuggestion {
  field: string;
  label: string;
  value: string;
  reason: string;
  source_type: 'ai_proposal';
}

export interface SmartDefaultsResult {
  product: string;
  destination: string;
  category: string;
  summary: string;
  suggestions: FieldSuggestion[];
  quickOption: {
    label: string;
    value: string;
  };
}

export function detectProductCategory(productName: string): string {
  const p = (productName || '').toLowerCase();

  if (
    p.includes('chilli') ||
    p.includes('chili') ||
    p.includes('pepper') ||
    p.includes('spice') ||
    p.includes('rice') ||
    p.includes('cardamom') ||
    p.includes('turmeric') ||
    p.includes('ginger') ||
    p.includes('onion') ||
    p.includes('garlic') ||
    p.includes('coffee bean') ||
    p.includes('grain') ||
    p.includes('wheat') ||
    p.includes('tea')
  ) {
    return 'agri_spices';
  }

  if (
    p.includes('bottle') ||
    p.includes('preform') ||
    p.includes('pet') ||
    p.includes('rpet') ||
    p.includes('plastic') ||
    p.includes('container') ||
    p.includes('packaging') ||
    p.includes('closure') ||
    p.includes('cap') ||
    p.includes('film')
  ) {
    return 'packaging_plastics';
  }

  if (
    p.includes('mug') ||
    p.includes('cup') ||
    p.includes('ceramic') ||
    p.includes('stoneware') ||
    p.includes('porcelain') ||
    p.includes('plate') ||
    p.includes('bowl') ||
    p.includes('tableware') ||
    p.includes('drinkware')
  ) {
    return 'ceramics_tableware';
  }

  if (
    p.includes('toy') ||
    p.includes('teddy') ||
    p.includes('plush') ||
    p.includes('bear') ||
    p.includes('doll') ||
    p.includes('figure')
  ) {
    return 'toys_novelties';
  }

  if (
    p.includes('benzoate') ||
    p.includes('acid') ||
    p.includes('chemical') ||
    p.includes('polymer') ||
    p.includes('resin') ||
    p.includes('solvent') ||
    p.includes('compound')
  ) {
    return 'chemicals';
  }

  if (
    p.includes('yarn') ||
    p.includes('cotton') ||
    p.includes('fabric') ||
    p.includes('textile') ||
    p.includes('apparel') ||
    p.includes('shirt') ||
    p.includes('garment') ||
    p.includes('towel')
  ) {
    return 'textiles_apparel';
  }

  return 'general_procurement';
}

export function generateSmartDefaults(
  productName: string,
  destinationCountry?: string,
  quantity?: number,
  unit?: string
): SmartDefaultsResult {
  const category = detectProductCategory(productName);
  const dest = (destinationCountry || 'Japan').trim();
  const destLower = dest.toLowerCase();
  const pLower = (productName || '').toLowerCase();

  // Region flags
  const isJapan = destLower.includes('japan') || destLower.includes('tokyo') || destLower.includes('kobe') || destLower.includes('yokohama');
  const isUSA = destLower.includes('usa') || destLower.includes('united states') || destLower.includes('america');
  const isEU = destLower.includes('france') || destLower.includes('germany') || destLower.includes('eu') || destLower.includes('italy') || destLower.includes('spain') || destLower.includes('netherlands');
  const isIndonesia = destLower.includes('indonesia') || destLower.includes('jakarta');
  const isUAE = destLower.includes('uae') || destLower.includes('dubai') || destLower.includes('emirates');

  const suggestions: FieldSuggestion[] = [];

  if (category === 'agri_spices') {
    const isChilli = pLower.includes('chilli') || pLower.includes('chili') || pLower.includes('pepper') || pLower.includes('teja');

    if (isChilli) {
      suggestions.push({
        field: 'specifications.material_grade',
        label: 'Quality & Heat Grade',
        value: 'Teja S17 Stemless, 75,000–95,000 SHU, Deep Red ASTA 50–70',
        reason: isJapan
          ? 'Japanese buyers almost exclusively prefer stemless Teja S17 with uniform heat and vibrant red color for spice processing.'
          : 'Teja S17 stemless is the top global export grade — balanced heat, high capsaicin, and easy factory handling.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'specifications.moisture',
        label: 'Maximum Moisture Level',
        value: 'Max 10.5% – 11.0%',
        reason: 'Keeping moisture strictly under 11% prevents aflatoxin and mold formation during ocean container transit.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'compliance.certifications',
        label: 'Certifications & Testing',
        value: isJapan
          ? 'Phytosanitary Certificate, JFSL / MHLW Pesticide Residue Analysis, FSSAI Export Clearance'
          : isUSA
          ? 'FDA Food Facility Registration, Phytosanitary Certificate, ASTA Cleanliness Standard'
          : isEU
          ? 'Phytosanitary Certificate, EU Aflatoxin & Pesticide MRL Screening (ISO 17025 accredited)'
          : 'Phytosanitary Certificate, Fumigation Certificate (ISPM 15), Certificate of Analysis',
        reason: isJapan
          ? 'Japanese customs quarantine (MHLW) routinely samples imported spices; pre-shipment residue testing avoids port hold-ups.'
          : 'Standard international phytosanitary and pesticide residue documentation for seamless customs clearance.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'packaging.packaging_type',
        label: 'Packaging Format',
        value: '25kg food-grade PP woven bags with inner polyethylene liner, palletized with desiccants',
        reason: 'Dual-layer moisture barrier bags preserve pungency and color across sea routes, fitted with silica gel in containers.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'logistics.shipping_mode',
        label: 'Shipment & Logistics',
        value: quantity && quantity > 1
          ? 'FCL Sea Freight in 40ft Dry High-Cube / 20ft Ventilated Containers'
          : 'FCL 20ft Container (~14 Metric Tons)',
        reason: 'Ventilated or moisture-controlled ocean containers are standard for bulk dry chilli shipments to protect product integrity.',
        source_type: 'ai_proposal',
      });
    } else {
      // General agri
      suggestions.push({
        field: 'specifications.material_grade',
        label: 'Product Grade',
        value: 'Grade A Export Quality, Clean Machine-Sorted',
        reason: 'Machine-cleaned and sorted agricultural commodities have standard commercial acceptance across international buyers.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'compliance.certifications',
        label: 'Certifications',
        value: isJapan ? 'Phytosanitary Certificate, JFSL Food Safety Test' : 'Phytosanitary Certificate, Fumigation, Certificate of Analysis (CoA)',
        reason: 'Baseline import quarantine paperwork required by customs authority.',
        source_type: 'ai_proposal',
      });
      suggestions.push({
        field: 'packaging.packaging_type',
        label: 'Packaging Format',
        value: '25kg / 50kg export multi-wall craft bags or PP woven bags',
        reason: 'Industry standard bulk handling format that stacks reliably in ocean containers.',
        source_type: 'ai_proposal',
      });
    }
  } else if (category === 'packaging_plastics') {
    suggestions.push({
      field: 'specifications.material_grade',
      label: 'Resin & Material Grade',
      value: isEU ? 'Food-Grade PET with 25%–30% Post-Consumer Recycled rPET' : '100% Virgin Food-Grade PET (Resin IV 0.80–0.84)',
      reason: isEU
        ? 'French AGEC law and EU PPWR directive mandate minimum 25% post-consumer rPET in beverage containers.'
        : 'Virgin bottle-grade PET provides maximum clarity, barrier properties, and shatter resistance.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'compliance.certifications',
      label: 'Certifications & Testing',
      value: isEU
        ? 'EU Regulation 10/2011 Food Contact Migration Test, Declaration of Compliance (DoC), REACH'
        : isUSA
        ? 'FDA 21 CFR 177.1630 (Polyethylene phthalate polymers), BPA-Free Certification'
        : 'Food Contact Migration Certificate (ISO 17025 accredited laboratory)',
      reason: 'Mandatory migration testing ensures plastics do not leach chemicals into food/beverage contents.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'packaging.packaging_type',
      label: 'Packaging Format',
      value: 'Dust-free polybags packed in 5-ply corrugated export master cartons, shrink-wrapped on pallets',
      reason: 'Prevents surface scratches and static dust accumulation during factory handling and ocean transit.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'commercial.incoterm',
      label: 'Commercial Terms',
      value: 'FOB (Free on Board) origin port with option for CIF destination benchmark',
      reason: 'FOB gives your logistics team direct control over shipping schedules and container freight costs.',
      source_type: 'ai_proposal',
    });
  } else if (category === 'ceramics_tableware') {
    suggestions.push({
      field: 'specifications.material_grade',
      label: 'Material & Firing Grade',
      value: 'High-Fired Stoneware / Glazed Ceramic (1280°C kiln fired, Lead & Cadmium Safe)',
      reason: 'High-fired stoneware is dishwasher and microwave safe with minimal water absorption (<0.5%).',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'compliance.certifications',
      label: 'Food Safety Compliance',
      value: isUSA
        ? 'FDA CPG Sec. 545.400 / 450 Lead & Cadmium Extraction Test (ASTM C738), California Prop 65 Compliant'
        : isEU
        ? 'EU Directive 84/500/EEC ceramic food contact compliance, LFGB / REACH'
        : 'Lead & Cadmium Leach Test Certificate (FDA / LFGB standard)',
      reason: 'Glaze safety screening is the primary customs inspection trigger for imported tableware.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'packaging.packaging_type',
      label: 'Transit Packaging',
      value: 'Individual egg-crate divider grid in 5-ply export master cartons with ISTA-1A drop-test certified foam pads',
      reason: 'Prevents transit breakage during ocean cargo handling; standard loss rate kept under 0.2%.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'quality.inspection_level',
      label: 'Quality Assurance Protocol',
      value: 'ANSI/ASQ Z1.4 (ISO 2859-1) Final Random Inspection at AQL 1.5 Major / 4.0 Minor',
      reason: 'Global standard for consumer ceramics to verify glaze consistency, pinholes, and thermal shock tolerance.',
      source_type: 'ai_proposal',
    });
  } else if (category === 'toys_novelties') {
    suggestions.push({
      field: 'specifications.material_grade',
      label: 'Fabric & Filling Spec',
      value: 'Super-Soft Crystal Velvet Plush Fabric with 100% Virgin PP Cotton Filling (hypoallergenic)',
      reason: 'Premium soft hand-feel, resilient bounce-back after vacuum compression packing, and odorless.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'compliance.certifications',
      label: 'Safety Standards',
      value: isEU
        ? 'CE Mark, EN 71 Parts 1, 2 & 3 (Mechanical, Flammability, Heavy Metals)'
        : isUSA
        ? 'ASTM F963-17 / CPSIA Children’s Product Certificate (CPC)'
        : isIndonesia
        ? 'SNI ISO 8124 Toy Safety Standard'
        : 'EN 71 / ASTM F963 Lab Test Report',
      reason: 'Mandatory toy safety compliance across international customs; prevents shipment seizure at entry port.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'packaging.packaging_type',
      label: 'Packaging Format',
      value: 'Individual polybag with air-vent hole, vacuum-packed in batches of 10 to reduce ocean CBM freight',
      reason: 'Vacuum compression cuts shipping container volume by 40–50%, substantially lowering landed shipping cost.',
      source_type: 'ai_proposal',
    });
  } else if (category === 'chemicals') {
    suggestions.push({
      field: 'specifications.material_grade',
      label: 'Purity & Grade',
      value: 'FCC IV / USP Food Grade, Purity ≥ 99.5%, White Granular/Powder',
      reason: 'Universal food and industrial grade standard with verified assay and low heavy metal trace.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'compliance.certifications',
      label: 'Compliance & Paperwork',
      value: 'Certificate of Analysis (CoA), 16-Section GHS Material Safety Data Sheet (MSDS), Halal & Kosher certified',
      reason: 'Standard documentation required for customs chemical clearance, shipping line stowage approval, and buyer QC.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'packaging.packaging_type',
      label: 'Packaging Format',
      value: '25kg multi-ply paper bags with PE inner liner on heat-treated fumigated pallets (ISPM 15)',
      reason: 'Protects hygroscopic powders against atmospheric humidity and complies with international pallet quarantine.',
      source_type: 'ai_proposal',
    });
  } else {
    // General procurement
    suggestions.push({
      field: 'specifications.material_grade',
      label: 'Commercial Grade',
      value: 'Commercial Premium Grade / Export Standard',
      reason: 'Standard manufacturing quality suitable for retail distribution or commercial application.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'compliance.certifications',
      label: 'Quality & Testing',
      value: 'ISO 9001 Factory Quality Management, Certificate of Origin, Pre-Shipment Inspection Report',
      reason: 'Baseline verification that goods originate from audited manufacturing facilities and meet contract specs.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'packaging.packaging_type',
      label: 'Packaging Standard',
      value: 'Export standard master cartons with reinforced strapping, palletized for forklift container loading',
      reason: 'Standard multi-modal freight packaging ensuring cargo reaches destination intact.',
      source_type: 'ai_proposal',
    });
    suggestions.push({
      field: 'commercial.incoterm',
      label: 'Commercial Terms',
      value: 'FOB origin port / CIF destination benchmark, 30% deposit / 70% against Bill of Lading',
      reason: 'Most balanced payment and trade terms for first-time international supplier engagements.',
      source_type: 'ai_proposal',
    });
  }

  const summary = `Based on typical ${productName} sourcing destined for ${dest}, I suggest the following market-tested baseline parameters. You can accept these as a starting point or adjust any field:`;

  return {
    product: productName,
    destination: dest,
    category,
    summary,
    suggestions,
    quickOption: {
      label: '✨ Suggest me — standard market defaults',
      value: `Suggest standard market specifications and shipment terms for ${productName} to ${dest}`,
    },
  };
}

/**
 * Helper to check if a user prompt is asking the AI to auto-suggest / recommend specifications
 */
export function isSuggestRequest(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase().trim();

  // Direct matches
  if (
    lower.includes('suggest me') ||
    lower.includes('suggest standard') ||
    lower.includes('smart default') ||
    lower.includes('recommend for me') ||
    lower.includes('you recommend') ||
    lower.includes('what do you suggest') ||
    lower.includes('what is standard') ||
    lower.includes('what\'s standard') ||
    lower.includes('use standard') ||
    lower.includes('you decide') ||
    lower.includes('default specs') ||
    lower.includes('best practices') ||
    lower.includes('market norm') ||
    lower.includes('i don\'t know') ||
    lower.includes('not sure')
  ) {
    return true;
  }

  // Regex patterns
  return Boolean(
    lower.match(/\b(suggest|recommend|auto[- ]?fill|fill[- ]?in|use defaults?|standard specs?)\b/) &&
    !lower.match(/\b(don\'t suggest|no suggestions?|stop)\b/)
  );
}
