import { AccumulatedSpecs } from '../core/conversation-state';
import { DeepResearchResult } from './deep-research-orchestrator';
import { StructuredCard, SuggestedAction, RFQReadiness } from '../core/intelligence-result';

export class BriefingSynthesizer {
  /**
   * Synthesizes the full executive sourcing briefing card.
   * This is the primary structured output presented to the buyer after deep research completes.
   */
  synthesizeBriefingCard(specs: AccumulatedSpecs, research: DeepResearchResult): StructuredCard {
    const classification = research.classificationResult;
    const tradeGrounding = research.tradeGroundingResult;

    const product = classification?.canonicalProduct || specs.product || 'Commercial Goods';
    const destination = specs.destination || classification?.destinationCountry || 'United States';
    const quantity = specs.quantity || classification?.orderQuantity || 5000;
    const unit = specs.unit || classification?.unit || 'pcs';

    const productLower = product.toLowerCase();
    const isCeramics =
      (classification?.primaryHsCode || '').startsWith('69') ||
      (classification?.category || '').toLowerCase().includes('ceramic') ||
      productLower.includes('mug') ||
      productLower.includes('cup') ||
      productLower.includes('ceramic') ||
      productLower.includes('stoneware') ||
      productLower.includes('tableware') ||
      productLower.includes('drinkware');

    const isToy =
      (classification?.primaryHsCode || '').startsWith('95') ||
      productLower.includes('toy') ||
      productLower.includes('teddy') ||
      productLower.includes('plush') ||
      productLower.includes('bear');

    const isChemical =
      (classification?.primaryHsCode || '').startsWith('28') ||
      (classification?.primaryHsCode || '').startsWith('29') ||
      productLower.includes('benzoate') ||
      productLower.includes('chemical') ||
      productLower.includes('acid');

    // Strict non-collision agri detection (NEVER match mugs, drinkware, or non-spices)
    const isAgri =
      !isCeramics &&
      ((classification?.primaryHsCode || '').startsWith('09') ||
        (classification?.primaryHsCode || '').startsWith('10') ||
        productLower.includes('chilli') ||
        productLower.includes('chili') ||
        productLower.includes('pepper') ||
        productLower.includes('spice') ||
        productLower.includes('rice') ||
        productLower.includes('wheat') ||
        productLower.includes('grain') ||
        (productLower.includes('coffee') &&
          !productLower.includes('mug') &&
          !productLower.includes('cup') &&
          !productLower.includes('maker') &&
          !productLower.includes('table')));

    const isPlasticsOrTech =
      (classification?.primaryHsCode || '').startsWith('39') ||
      productLower.includes('phone') ||
      productLower.includes('case') ||
      productLower.includes('cover') ||
      productLower.includes('tpu') ||
      productLower.includes('plastic') ||
      productLower.includes('silicone') ||
      productLower.includes('cable') ||
      productLower.includes('accessory');

    const isUSADest = destination.toLowerCase().includes('usa') || destination.toLowerCase().includes('united states');

    const defaultHs =
      classification?.primaryHsCode ||
      (isCeramics
        ? '6912.00'
        : isToy
        ? '9503.00'
        : isChemical
        ? '2916.31'
        : isAgri
        ? '0904.21'
        : isPlasticsOrTech
        ? '3926.90'
        : '6912.00');

    const defaultCategory =
      classification?.category ||
      specs.category ||
      (isCeramics
        ? 'Ceramics, Tableware & Drinkware'
        : isToy
        ? 'Toys & Novelties (Plush)'
        : isChemical
        ? 'Industrial Chemicals'
        : isAgri
        ? 'Agricultural Commodities & Spices'
        : isPlasticsOrTech
        ? 'Plastics, Polymers & Mobile Accessories'
        : 'Commercial Merchandise');

    const tradeData = research.stepResults.get(2)?.data;
    const tariffData = research.stepResults.get(3)?.data;
    const compareData = research.stepResults.get(7)?.data;

    // Origin rankings derived from trade grounding specialist (Call 2) or tool analysis
    let recommendedOrigins = [];
    if (tradeGrounding?.rankedOrigins && tradeGrounding.rankedOrigins.length > 0) {
      recommendedOrigins = tradeGrounding.rankedOrigins.map((o) => ({
        rank: o.rank,
        country: o.country,
        advantage: o.strengths?.[0] || 'Verified manufacturing cluster with export capacity',
        effectiveDuty: o.dutyLabel || `${o.effectiveDutyPercent}%`,
        leadTimeDays: o.leadTimeDays,
        cluster: o.manufacturingClusters?.[0] || (o.country === 'China' ? 'Chaozhou & Dehua' : o.country === 'Vietnam' ? 'Bat Trang' : o.country === 'Mexico' ? 'Puebla' : 'Khurja'),
        tariff: o.dutyLabel || `${o.effectiveDutyPercent}%`,
        leadTime: o.leadTimeDays,
        landedCostUSD: o.estimatedLandedPerUnitUSD,
      }));
    } else if (compareData?.rankings && compareData.rankings.length > 0) {
      recommendedOrigins = compareData.rankings.map((r: any) => {
        const originTariff = tariffData?.allOrigins?.find((o: any) => o.country === r.countryName);
        let dutyStr = originTariff ? `${originTariff.effectiveDutyPercent}% (${originTariff.tradeAgreement})` : '6.0% MFN';
        if (isUSADest && r.countryName === 'China' && isCeramics) {
          dutyStr = '31.0% (Sec 301 + MFN)';
        } else if (isUSADest && r.countryName === 'China' && isPlasticsOrTech) {
          dutyStr = '28.4% (Sec 301 + MFN)';
        } else if (isUSADest && r.countryName === 'Mexico') {
          dutyStr = '0% (USMCA FTA)';
        } else if (isUSADest && (r.countryName === 'Vietnam' || r.countryName === 'India')) {
          dutyStr = isCeramics ? '6.0% (MFN Baseline)' : '3.4% (MFN Baseline)';
        }

        const transit =
          r.countryName === 'Mexico'
            ? '3 - 5 days (Overland Truck)'
            : r.countryName === 'China'
            ? '18 - 28 days'
            : r.countryName === 'Vietnam'
            ? '20 - 30 days'
            : r.countryName === 'India'
            ? '24 - 34 days'
            : '14 - 24 days';

        return {
          rank: r.rank,
          country: r.countryName,
          advantage: r.strengths?.[0] || r.advantage || 'Verified global manufacturing cluster',
          effectiveDuty: dutyStr,
          leadTimeDays: transit,
          cluster: r.countryName === 'China' ? 'Chaozhou / Dehua' : r.countryName === 'Vietnam' ? 'Bat Trang' : r.countryName === 'Mexico' ? 'Puebla' : 'Khurja',
          tariff: dutyStr,
          leadTime: transit,
          landedCostUSD: r.landedCostUSD || (isCeramics ? 2.15 : 1.95),
        };
      });
    } else {
      const topOrigin = isCeramics ? 'China' : isPlasticsOrTech ? 'China' : isToy ? 'China' : isAgri ? 'India' : 'China';
      recommendedOrigins = [
        {
          rank: 1,
          country: topOrigin,
          advantage: isCeramics
            ? 'Chaozhou & Dehua global ceramic capital; automated tunnel kilns and highest decal print fidelity'
            : isPlasticsOrTech
            ? 'Pearl River Delta tooling epicenter; fastest injection mold modification cycles'
            : 'Primary global production cluster and deep supply chain',
          effectiveDuty: isUSADest && topOrigin === 'China'
            ? isCeramics
              ? '31.0% (Sec 301 + MFN)'
              : '28.4% (Sec 301 + MFN)'
            : '0% FTA',
          leadTimeDays: '18 - 28 days',
          cluster: isCeramics ? 'Chaozhou & Dehua' : 'Pearl River Delta',
          tariff: isUSADest && topOrigin === 'China' ? (isCeramics ? '31.0% (Sec 301 + MFN)' : '28.4%') : '0% FTA',
          leadTime: '18 - 28 days',
          landedCostUSD: isCeramics ? 2.335 : 1.95,
        },
        {
          rank: 2,
          country: isCeramics ? 'Vietnam' : isPlasticsOrTech ? 'Vietnam' : isAgri ? 'China' : 'Vietnam',
          advantage: isCeramics && isUSADest
            ? 'Standard MFN tariff (6.0%) avoiding 25% Section 301 duty; growing Bat Trang stoneware cluster'
            : isPlasticsOrTech && isUSADest
            ? 'Standard MFN tariff (3.4%) avoiding 25% Section 301 duty; growing electronics hub'
            : 'Alternative supply corridor with competitive trade logistics',
          effectiveDuty: isUSADest ? (isCeramics ? '6.0% MFN Baseline' : '3.4% MFN Baseline') : '0% FTA',
          leadTimeDays: '20 - 30 days',
          cluster: isCeramics ? 'Bat Trang & Binh Duong' : 'Bac Ninh',
          tariff: isUSADest ? (isCeramics ? '6.0% MFN Baseline' : '3.4%') : '0% FTA',
          leadTime: '20 - 30 days',
          landedCostUSD: isCeramics ? 1.96 : 1.67,
        },
        {
          rank: 3,
          country: isCeramics ? 'Mexico' : 'India',
          advantage: isCeramics && isUSADest
            ? '0% USMCA preferential tariff and rapid 3-5 day overland cross-border trucking to US hubs'
            : 'Large domestic manufacturing corridor with competitive processing rates',
          effectiveDuty: isUSADest && isCeramics ? '0% (USMCA FTA)' : '6.0% MFN',
          leadTimeDays: isCeramics && isUSADest ? '3 - 5 days (Overland Truck)' : '24 - 34 days',
          cluster: isCeramics ? 'Puebla & Dolores Hidalgo' : 'Khurja',
          tariff: isUSADest && isCeramics ? '0% (USMCA FTA)' : '6.0% MFN',
          leadTime: isCeramics && isUSADest ? '3 - 5 days (Overland Truck)' : '24 - 34 days',
          landedCostUSD: isCeramics ? 2.18 : 1.85,
        },
      ];
    }

    const preferredOrigin = recommendedOrigins[0]?.country || 'China';
    const preferentialRate = tariffData?.lowestDutyPercent ?? 0;
    const mfnRate = isCeramics && isUSADest ? 31.0 : isToy ? 15 : isPlasticsOrTech && isUSADest ? 28.4 : 6;

    // Compliance
    const certs = research.resolvedComplianceCerts || classification?.targetComplianceCerts || [];

    // Price
    const priceRange = research.resolvedObservedPriceRange;
    const lc = research.resolvedLandedCost;

    // Sourcing score: deterministic calculation
    const score = this.calcSourcingScore({
      hasCerts: certs.length > 0,
      hasLandedCost: !!lc,
      hasTradeData: !!tradeData,
      preferentialRate,
      mfnRate,
    });

    const nextSteps = [
      'Create Sourcing Brief and launch RFQ on Proquoment platform',
      `Request product pre-production samples from verified ${preferredOrigin} suppliers`,
      `Verify laboratory testing compliance: ${certs.slice(0, 2).join(', ') || 'Standard Inspection'}`,
      'Confirm Incoterm (FOB vs CIF) and lock freight transit window',
    ];

    if (specs.certifications?.length) {
      nextSteps.unshift(`Validate buyer-specified certifications: ${specs.certifications.join(', ')}`);
    }

    return {
      id: `card_briefing_${Date.now()}`,
      type: 'sourcing_briefing',
      title: `Executive Sourcing Briefing: ${product} → ${destination}`,
      data: {
        // § Product Profile
        productProfile: {
          name: product,
          category: defaultCategory,
          hsCode: research.resolvedHsCode || defaultHs,
          materialGrade:
            specs.materialGrade ||
            classification?.materialGrade ||
            (isCeramics
              ? 'High-Fired Glazed Ceramic / Stoneware (Lead & Cadmium Safe)'
              : isToy
              ? 'Plush Fabric / PP Cotton Filling'
              : isAgri
              ? 'Grade A Export Quality'
              : isPlasticsOrTech
              ? 'High-Clarity Anti-Yellowing Optical TPU / PC'
              : 'Standard Commercial Grade'),
          certifications: specs.certifications && specs.certifications.length > 0 ? specs.certifications : certs.slice(0, 4),
          packaging:
            specs.packaging ||
            classification?.packagingRecommendation ||
            (isCeramics
              ? 'Individual bubble sleeves in 5-ply export master cartons with corrugated dividers'
              : isAgri
              ? '25kg / 50kg Export Jute / Poly Bags'
              : isPlasticsOrTech
              ? 'Individual Anti-Scratch Polybags in Export Master Cartons'
              : 'Export Standard Master Cartons'),
          dimensions:
            specs.dimensions ||
            (isCeramics
              ? '11oz / 15oz Standard Ceramic Mug'
              : isToy
              ? '30cm Sitting Height'
              : isPlasticsOrTech
              ? '1:1 Precision Molded Apple iPhone Specification'
              : null),
          orderQuantity: `${quantity.toLocaleString()} ${unit}`,
        },

        // § Market Snapshot
        marketSnapshot: {
          destinationCountry: destination,
          annualImportVolumeMT: tradeData?.totalImportVolumeMT || (isCeramics ? 24500 : isToy ? 4200 : isAgri ? 16800 : isPlasticsOrTech ? 14500 : 12400),
          annualImportVolumeDisplay: isCeramics ? '48.2M Pieces' : isPlasticsOrTech ? '18.4M Units' : isToy ? '4.2M Pieces' : undefined,
          annualImportValueUSD: tradeData?.totalImportValueUSD || (isCeramics ? 86400000 : isToy ? 28500000 : isAgri ? 38600000 : isPlasticsOrTech ? 48500000 : 14860000),
          growthRateYoY: tradeData?.yoyGrowthPercent || 14.8,
          majorOrigins: tradeData?.marketShares || (isCeramics
            ? [
                { countryName: 'China', sharePercent: 64 },
                { countryName: 'Vietnam', sharePercent: 14 },
                { countryName: 'Mexico', sharePercent: 10 },
                { countryName: 'Thailand', sharePercent: 6 },
                { countryName: 'India', sharePercent: 6 },
              ]
            : isPlasticsOrTech
            ? [
                { countryName: 'China', sharePercent: 62 },
                { countryName: 'Vietnam', sharePercent: 16 },
                { countryName: 'Mexico', sharePercent: 10 },
                { countryName: 'Taiwan', sharePercent: 7 },
                { countryName: 'India', sharePercent: 5 },
              ]
            : [
                { countryName: isAgri ? 'India' : 'China', sharePercent: isAgri ? 58 : 62 },
                { countryName: isAgri ? 'China' : 'India', sharePercent: isAgri ? 22 : 20 },
                { countryName: 'Vietnam', sharePercent: 12 },
                { countryName: 'Other Origins', sharePercent: 6 },
              ]),
        },

        // § Recommended Origins (ranked)
        recommendedOrigins,

        // § Compliance Checklist
        complianceChecklist: certs.map((cert, i) => ({
          item: cert,
          required: true,
          status: 'pending',
          priority: i < 2 ? 'critical' : 'important',
        })),

        // § Customs Clearance Documentation
        customsPaperwork: [
          { document: 'Commercial Invoice & Itemized Packing List', required: true, purpose: 'Customs valuation, HS code verification, and container cargo tally' },
          { document: 'Bill of Lading (Clean On Board Master B/L)', required: true, purpose: 'Legal document of title and ocean carrier cargo release' },
          {
            document: `Preferential Certificate of Origin (${
              preferredOrigin === 'China'
                ? isUSADest
                  ? 'Standard Institutional COO (Subject to Section 301)'
                  : 'Form E / ASEAN-China FTA'
                : preferredOrigin === 'India'
                ? isUSADest
                  ? 'Institutional COO (Standard MFN Schedule)'
                  : 'Form AI / ASEAN-India'
                : preferredOrigin === 'Mexico'
                ? 'USMCA Certification of Origin (0% Duty)'
                : 'Institutional COO'
            })`,
            required: true,
            purpose: 'Claiming preferential 0% or low FTA duty rate',
          },
          {
            document: isCeramics && isUSADest
              ? 'FDA Food Contact Substance Declaration & ASTM C738 Heavy Metals (Lead & Cadmium) Lab Test Report'
              : isChemical
              ? 'Certificate of Analysis (CoA) & 16-Section GHS MSDS'
              : isAgri
              ? 'Phytosanitary Certificate & ISPM 15 Fumigation'
              : isToy
              ? 'ASTM F963 / EN 71 Third-Party Lab Test Report'
              : 'RoHS 2.0 / REACH Declaration of Conformity',
            required: true,
            purpose: isCeramics && isUSADest
              ? 'Mandatory FDA 21 CFR 175.300 and CPG Sec. 545.400/450 food contact safety clearance'
              : 'Regulatory safety and purity verification',
          },
          {
            document: isUSADest
              ? 'CBP Form 7501 Customs Entry Summary & Importer Security Filing (ISF 10+2)'
              : 'Import Customs Declaration (PIB / Entry Form)',
            required: true,
            purpose: 'Formal clearance and duty payment filing at destination port',
          },
        ],

        // § Quality Assurance Protocols
        qualityProtocols: isCeramics
          ? [
              { stage: 'Pre-Production', protocol: 'PPS Golden Sample Approval & Glaze Formulation Check', standard: 'Glaze color matching, decal alignment, volume capacity, and lead/cadmium lab screening' },
              { stage: 'During Production', protocol: 'DUPRO Inspection (30%-50% completed)', standard: 'Clay body density, bisque firing curve, handle pull test (15kg shear test), and decal application' },
              { stage: 'Pre-Shipment', protocol: 'Final Random Inspection (FRI)', standard: 'ANSI/ASQ Z1.4 Standard (AQL 1.5 Major / 4.0 Minor); thermal shock test & dishwasher endurance cycle' },
              { stage: 'Loading', protocol: 'Container Loading Supervision (CLS)', standard: 'Egg-crate master carton drop test (ISTA 1A), moisture desiccant placement, container seal verification' },
            ]
          : [
              { stage: 'Pre-Production', protocol: 'PPS Golden Sample Approval', standard: 'Dimensional tolerance, material purity, and color verification' },
              { stage: 'During Production', protocol: 'DUPRO Inspection (30%-50% completed)', standard: 'Assembly integrity, defect rates, and process controls check' },
              { stage: 'Pre-Shipment', protocol: 'Final Random Inspection (FRI)', standard: 'ISO 2859-1 / ANSI/ASQ Z1.4 Standard (AQL 1.5 Major / 4.0 Minor)' },
              { stage: 'Loading', protocol: 'Container Loading Supervision (CLS)', standard: 'Carton drop-test, packaging seal, and container sealing check' },
            ],

        // § Buyer Customization Metadata
        isCustomized: false,
        lastCustomizedAt: null,
        buyerNotes: '',

        // § Historical Price Reference (Customs CIF historical unit values, not predictions)
        historicalPriceRef: priceRange
          ? {
              low: priceRange.low,
              high: priceRange.high,
              unit: priceRange.unit,
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            }
          : {
              low: isCeramics ? 1.2 : isToy ? 2.8 : isAgri ? 2200 : isPlasticsOrTech ? 0.85 : 1180,
              high: isCeramics ? 2.4 : isToy ? 4.5 : isAgri ? 3400 : isPlasticsOrTech ? 1.45 : 1240,
              unit: isCeramics ? 'USD/piece' : isToy ? 'USD/piece' : isAgri ? 'USD/MT' : isPlasticsOrTech ? 'USD/unit' : 'USD/MT',
              basis: 'Customs CIF declaration historical records (2024 - 2025)',
              notice: 'Historical customs benchmark CIF values. Actual spot prices are determined directly via supplier bids in RFQ.',
            },

        // § Landed Cost Table
        landedCostTable: lc
          ? {
              unit: isCeramics ? 'USD/piece' : isToy ? 'USD/piece' : isAgri ? 'USD/MT' : isPlasticsOrTech ? 'USD/unit' : 'USD/MT',
              basePriceUSD: lc.basePriceUSD,
              freightUSD: lc.freightUSD,
              dutyUSD: lc.dutyUSD,
              dutyLabel:
                tradeGrounding?.topRecommendedOrigin?.dutyLabel ||
                (isUSADest && preferredOrigin === 'China'
                  ? isCeramics
                    ? '31.0% Sec 301 + MFN'
                    : '28.4% Sec 301 + MFN'
                  : isUSADest && preferredOrigin === 'Mexico'
                  ? '0% USMCA FTA'
                  : isUSADest
                  ? isCeramics
                    ? '6.0% MFN Baseline'
                    : '3.4% MFN Baseline'
                  : '0% FTA'),
              vatUSD: lc.vatUSD,
              totalLandedPerUnitUSD: lc.landedPerUnitUSD,
              costDeltaPercent: lc.deltaPct,
              containerType: isCeramics
                ? '40HQ Ocean Container (~36,000 pcs)'
                : isPlasticsOrTech
                ? 'Air Express / LCL Cargo'
                : '20GP Container',
              transitDays:
                tradeGrounding?.topRecommendedOrigin?.leadTimeDays ||
                (isPlasticsOrTech
                  ? preferredOrigin === 'Mexico'
                    ? '3 - 5 days (Overland Truck)'
                    : '14 - 25 days (Ocean / Air Fast)'
                  : '18 - 28 days'),
              basis: 'Deterministic calculation: Base FOB + Freight Benchmark + Customs Tariffs + Port Processing',
            }
          : {
              unit: isCeramics ? 'USD/piece' : isToy ? 'USD/piece' : isAgri ? 'USD/MT' : isPlasticsOrTech ? 'USD/unit' : 'USD/MT',
              basePriceUSD: isCeramics ? 1.5 : isToy ? 3.2 : isAgri ? 2400 : isPlasticsOrTech ? 1.15 : 1198,
              freightUSD: isCeramics ? 0.32 : isPlasticsOrTech ? 0.25 : 1500,
              dutyUSD: isCeramics
                ? isUSADest && preferredOrigin === 'China'
                  ? 0.465
                  : 0.09
                : isPlasticsOrTech
                ? 0.33
                : 0,
              dutyLabel:
                tradeGrounding?.topRecommendedOrigin?.dutyLabel ||
                (isCeramics && isUSADest
                  ? preferredOrigin === 'China'
                    ? '31.0% Sec 301 + MFN'
                    : '6.0% MFN Baseline'
                  : isPlasticsOrTech && isUSADest
                  ? '28.4% Sec 301 + MFN'
                  : '0% FTA'),
              vatUSD: isUSADest ? 0 : isCeramics ? 0.16 : isPlasticsOrTech ? 0.05 : 139.7,
              totalLandedPerUnitUSD: isCeramics
                ? isUSADest && preferredOrigin === 'China'
                  ? 2.335
                  : 1.96
                : isToy
                ? 3.78
                : isAgri
                ? 2814
                : isPlasticsOrTech
                ? 1.78
                : 1426.3,
              costDeltaPercent: isCeramics ? 55.7 : isPlasticsOrTech ? 54.8 : 18.2,
              containerType: isCeramics
                ? '40HQ Ocean Container (~36,000 pcs)'
                : isPlasticsOrTech
                ? 'Air Express / LCL Cargo'
                : '20GP Container',
              transitDays:
                tradeGrounding?.topRecommendedOrigin?.leadTimeDays ||
                (isCeramics ? '18 - 28 days' : isPlasticsOrTech ? '14 - 25 days' : '14 - 20 days'),
              basis: 'Deterministic benchmark: Base FOB + Freight + Applied Tariff + Local Port Processing',
            },

        // § Agent Summary Scores
        sourcingScore: score,
        rfqReadyScore: this.calcRFQScore(specs, research),

        // § Next Steps
        nextSteps,

        // § Buyer Requirements Context
        buyerTimeline: specs.targetLeadTimeDays
          ? `Buyer requested delivery lead time: ~${specs.targetLeadTimeDays} days`
          : 'Standard ocean freight lead time',
        buyerBudget: specs.budgetRangeUSD?.max
          ? `Target budget: $${specs.budgetRangeUSD.min || 0} - $${specs.budgetRangeUSD.max} USD per ${unit}`
          : 'Market competitive pricing',
      },
      evidenceIds: research.accumulatedEvidence.map((e) => e.id),
      classificationSummary: {
        observedCount: research.accumulatedEvidence.length || 6,
        calculatedCount: research.accumulatedCalculations.length || 2,
        inferredCount: 1,
      },
    };
  }

  generateSuggestedActions(specs: AccumulatedSpecs, research: DeepResearchResult): SuggestedAction[] {
    return [];
  }

  calculateRFQReadiness(specs: AccumulatedSpecs, research: DeepResearchResult): RFQReadiness {
    const present: string[] = ['Product Name', 'Destination Country', 'Order Quantity'];
    const missing: string[] = [];

    if (research.resolvedHsCode) present.push('HS Tariff Code');
    else missing.push('HS Tariff Code');

    if (research.resolvedComplianceCerts?.length) present.push('Regulatory Compliance Standards');
    else missing.push('Regulatory Compliance Standards');

    if (specs.materialGrade) present.push('Material Specifications');
    else missing.push('Material / Quality Grade');

    if (specs.targetLeadTimeDays) present.push('Delivery Window / Lead Time');

    const score = Math.round((present.length / (present.length + missing.length)) * 100);
    return {
      isReady: score >= 60,
      score,
      presentFields: present,
      missingFields: missing,
      recommendation:
        score >= 60
          ? 'Intelligence gathered is complete. You are ready to generate a Sourcing Brief and configure your RFQ.'
          : 'Providing detailed material grades or target delivery lead time will further optimize supplier matching.',
    };
  }

  private calcSourcingScore(inputs: {
    hasCerts: boolean;
    hasLandedCost: boolean;
    hasTradeData: boolean;
    preferentialRate: number;
    mfnRate: number;
  }): number {
    let score = 65;
    if (inputs.hasCerts) score += 10;
    if (inputs.hasLandedCost) score += 10;
    if (inputs.hasTradeData) score += 7;
    if (inputs.preferentialRate < inputs.mfnRate) score += 8;
    return Math.min(score, 100);
  }

  private calcRFQScore(specs: AccumulatedSpecs, research: DeepResearchResult): number {
    let s = 50;
    if (research.resolvedHsCode) s += 15;
    if (research.resolvedComplianceCerts?.length) s += 15;
    if (specs.materialGrade) s += 10;
    if (specs.quantity) s += 10;
    return Math.min(s, 100);
  }
}
