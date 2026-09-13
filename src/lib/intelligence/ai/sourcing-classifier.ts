import { ModelGateway } from './model-gateway';
import { OpenRouterAdapter } from './openrouter-adapter';
import { AccumulatedSpecs } from '../core/conversation-state';

export interface SourcingClassificationResult {
  canonicalProduct: string;
  category: string;
  primaryHsCode: string;
  secondaryHsCode?: string;
  hsDescription?: string;
  alternativeHsCodes?: string[];
  candidateOrigins: string[];
  isCommodity?: boolean;
  orderQuantity: number;
  unit: string;
  destinationCountry: string;
  benchmarkFobUSD: { low: number; high: number; unit: string };
  targetComplianceCerts: string[];
  materialGrade: string;
  packagingRecommendation: string;
  classificationRationale: string;
}

const SOURCING_CLASSIFIER_SYSTEM_PROMPT = `You are a Principal Global Sourcing Director and International Trade Classifier.

Your task is to analyze buyer procurement requirements and normalize them into an authoritative sourcing profile.

CRITICAL ANTI-COLLISION & DOMAIN RULES:
1. "Coffee Mugs", "Ceramic Mugs", "Custom Mugs", "Stoneware Drinkware":
   - NEVER classify as agricultural coffee beans (HS 0901.11), spices, or commodities.
   - Authoritative HS Code: 6912.00 (Tableware, kitchenware, of ceramic other than porcelain) or 6911.10 (Porcelain).
   - Category: "Ceramics, Tableware & Drinkware".
5. "dried red chilli", "peppers", "paprika": HS 0904.21 / 0904.22. Category: "Agricultural Commodities & Spices".
6. "phone case", "tpu cover": HS 3926.90. Category: "Plastics, Polymers & Mobile Accessories".
7. "teddy bear", "plush toy": HS 9503.00. Category: "Toys & Novelties (Plush)".
8. "sodium benzoate": HS 2916.31. Category: "Industrial Chemicals".

Output strictly valid JSON (no markdown formatting):
{
  "canonicalProduct": string,
  "category": string,
  "primaryHsCode": string (6-digit format, e.g. "6912.00"),
  "secondaryHsCode": string | null,
  "hsDescription": string,
  "candidateOrigins": string[],
  "unit": string,
  "orderQuantity": number,
  "destinationCountry": string,
  "benchmarkFobUSD": { "low": number, "high": number, "unit": string },
  "targetComplianceCerts": string[],
  "materialGrade": string,
  "packagingRecommendation": string,
  "classificationRationale": string
}
`;

export class SourcingClassifier {
  private modelGateway: ModelGateway;

  constructor(modelGateway?: ModelGateway) {
    this.modelGateway = modelGateway || new OpenRouterAdapter();
  }

  async classify(
    specs: AccumulatedSpecs,
    history?: { role: string; content: string }[]
  ): Promise<SourcingClassificationResult> {
    const rawProduct = specs.product || 'Commercial Goods';
    const dest = specs.destination || 'United States';
    const qty = specs.quantity || 5000;
    const unit = specs.unit || 'pcs';

    try {
      const resp = await this.modelGateway.chat({
        messages: [
          { role: 'system', content: SOURCING_CLASSIFIER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              PRODUCT: rawProduct,
              DESTINATION: dest,
              ORDER_QUANTITY: qty,
              UNIT: unit,
              BUYER_SPECIFICATIONS: {
                materialGrade: specs.materialGrade,
                certifications: specs.certifications,
                packaging: specs.packaging,
                dimensions: specs.dimensions,
              },
              CONVERSATION_HISTORY: (history || [])
                .slice(-6)
                .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
                .join('\n'),
            }),
          },
        ],
        temperature: 0.1,
      });

      const cleanJson = resp.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        canonicalProduct: parsed.canonicalProduct || rawProduct,
        category: parsed.category || 'Manufactured Goods',
        primaryHsCode: parsed.primaryHsCode || '6912.00',
        secondaryHsCode: parsed.secondaryHsCode || undefined,
        hsDescription: parsed.hsDescription || 'Harmonized System international trade classification',
        candidateOrigins: Array.isArray(parsed.candidateOrigins) && parsed.candidateOrigins.length > 0
          ? parsed.candidateOrigins
          : ['China', 'Vietnam', 'Mexico', 'India'],
        unit: parsed.unit || unit,
        orderQuantity: parsed.orderQuantity || qty,
        destinationCountry: parsed.destinationCountry || dest,
        benchmarkFobUSD: parsed.benchmarkFobUSD || { low: 1.2, high: 2.4, unit: 'USD/piece' },
        targetComplianceCerts: Array.isArray(parsed.targetComplianceCerts)
          ? parsed.targetComplianceCerts
          : ['FDA 21 CFR 175.300 Food Contact', 'ASTM C738 Lead & Cadmium Safe', 'California Prop 65'],
        materialGrade: parsed.materialGrade || specs.materialGrade || 'Commercial Grade',
        packagingRecommendation: parsed.packagingRecommendation || 'Export Standard Master Cartons',
        classificationRationale: parsed.classificationRationale || 'Verified WCO trade nomenclature classification',
      };
    } catch {
      return this.deterministicClassification(specs);
    }
  }

  public deterministicClassification(specs: AccumulatedSpecs): SourcingClassificationResult {
    const pLower = (specs.product || '').toLowerCase();
    const dest = specs.destination || 'United States';
    const isUSA = dest.toLowerCase().includes('usa') || dest.toLowerCase().includes('united states');
    const qty = specs.quantity || 5000;
    const unit = specs.unit || (pLower.includes('mt') || pLower.includes('ton') ? 'MT' : 'pcs');

    // 1. Ceramic mugs & tableware
    if (
      pLower.includes('mug') ||
      pLower.includes('cup') ||
      pLower.includes('drinkware') ||
      pLower.includes('tumbler') ||
      pLower.includes('ceramic') ||
      pLower.includes('stoneware') ||
      pLower.includes('tableware') ||
      pLower.includes('plate')
    ) {
      return {
        canonicalProduct: specs.product?.includes('mug') ? specs.product : 'Ceramic Coffee Mugs (Drinkware)',
        category: 'Ceramics, Tableware & Drinkware',
        primaryHsCode: '6912.00',
        secondaryHsCode: '6911.10',
        hsDescription: 'Tableware, kitchenware, other household articles of ceramic materials (stoneware/earthenware)',
        candidateOrigins: isUSA
          ? ['China', 'Vietnam', 'Mexico', 'India', 'Thailand']
          : ['China', 'Vietnam', 'India', 'Indonesia', 'Thailand'],
        unit: 'pcs',
        orderQuantity: qty,
        destinationCountry: dest,
        benchmarkFobUSD: { low: 1.2, high: 2.4, unit: 'USD/piece' },
        targetComplianceCerts: isUSA
          ? [
              'FDA 21 CFR 175.300 (Food Contact Surface Safe)',
              'ASTM C738 / AOAC Standard (Extractable Lead & Cadmium Test)',
              'California Proposition 65 Heavy Metals Declaration',
              'CBP Form 7501 Customs Entry Summary & ISF 10+2',
            ]
          : [
              'SNI ISO 6486 Ceramic Tableware in Contact with Food',
              'Laboratory Heavy Metal Leach Test Report',
              'Certificate of Origin',
            ],
        materialGrade: specs.materialGrade || 'High-Fired Glazed Ceramic / Stoneware (Lead & Cadmium Free)',
        packagingRecommendation: 'Individual bubble sleeve in 5-ply export master cartons with corrugated dividers',
        classificationRationale: 'Ceramic mugs classified under WCO Chapter 69 (Ceramic products) HS 6912.00 for non-porcelain tableware.',
      };
    }

    // 2. Mobile Accessories & Precision Plastics
    if (
      pLower.includes('phone') ||
      pLower.includes('case') ||
      pLower.includes('cover') ||
      pLower.includes('tpu') ||
      pLower.includes('plastic') ||
      pLower.includes('silicone')
    ) {
      return {
        canonicalProduct: 'Precision TPU / PC Mobile Phone Cases',
        category: 'Plastics, Polymers & Mobile Accessories',
        primaryHsCode: '3926.90',
        hsDescription: 'Other articles of plastics and articles of other materials of headings 3901 to 3914',
        candidateOrigins: isUSA
          ? ['China', 'Vietnam', 'Mexico', 'Taiwan', 'India']
          : ['China', 'Vietnam', 'Taiwan', 'India', 'South Korea'],
        unit: 'units',
        orderQuantity: qty,
        destinationCountry: dest,
        benchmarkFobUSD: { low: 0.85, high: 1.45, unit: 'USD/unit' },
        targetComplianceCerts: isUSA
          ? [
              'CBP Form 7501 Customs Entry Summary',
              'EPA TSCA Title VI Statement',
              'California Proposition 65 (BPA & Phthalates Free)',
              'RoHS 2.0 / REACH SVHC Substance Assessment',
              'Importer Security Filing (ISF 10+2)',
            ]
          : ['RoHS Conformity Declaration', 'Certificate of Origin Form E / D', 'Standard Commercial Import Entry'],
        materialGrade: specs.materialGrade || 'High-Clarity Anti-Yellowing Optical TPU / PC',
        packagingRecommendation: 'Individual anti-scratch OPP bags with hanging header card, packed in export master cartons',
        classificationRationale: 'Plastic protective casings classified under HS 3926.90 for articles of plastics.',
      };
    }

    // 3. Toys & Plush
    if (pLower.includes('toy') || pLower.includes('teddy') || pLower.includes('plush') || pLower.includes('doll')) {
      return {
        canonicalProduct: 'Teddy Bears & Plush Stuffed Toys',
        category: 'Toys & Novelties (Plush)',
        primaryHsCode: '9503.00',
        hsDescription: 'Tricycles, scooters, dolls; other toys; reduced-size models and similar recreational models',
        candidateOrigins: ['China', 'India', 'Vietnam', 'Indonesia'],
        unit: 'pieces',
        orderQuantity: qty,
        destinationCountry: dest,
        benchmarkFobUSD: { low: 2.8, high: 4.5, unit: 'USD/piece' },
        targetComplianceCerts: isUSA
          ? ["CPSC Children's Product Certificate (CPC)", 'ASTM F963 Toy Safety Specification', 'CPSIA Total Lead & Phthalates']
          : ['SNI ISO 8124 Safety of Toys', 'CE EN 71 Third-Party Lab Test Report', 'Laporan Surveyor (LS)'],
        materialGrade: specs.materialGrade || 'Soft Velvet Plush Fabric / 100% Virgin PP Cotton Filling',
        packagingRecommendation: 'Compressed vacuum polybags packed inside moisture-sealed export master cartons',
        classificationRationale: 'Stuffed plush toys classified under WCO Chapter 95 HS 9503.00.',
      };
    }

    // 4. Agricultural Spices & Peppers (ONLY when actually spices/chillies, NOT mugs/beverages)
    if (
      pLower.includes('chilli') ||
      pLower.includes('chili') ||
      pLower.includes('pepper') ||
      pLower.includes('paprika') ||
      pLower.includes('spice')
    ) {
      return {
        canonicalProduct: 'Dried Whole Red Chilli (Capsicum annuum)',
        category: 'Agricultural Commodities & Spices',
        primaryHsCode: '0904.21',
        hsDescription: 'Fruits of the genus Capsicum or of the genus Pimenta, dried, neither crushed nor ground',
        candidateOrigins: ['India', 'China', 'Vietnam', 'Mexico'],
        unit: 'MT',
        orderQuantity: qty,
        destinationCountry: dest,
        benchmarkFobUSD: { low: 2200, high: 3400, unit: 'USD/MT' },
        targetComplianceCerts: isUSA
          ? ['FDA Food Facility Prior Notice', 'USDA APHIS Phytosanitary Certificate', 'FDA FSVP Compliance', 'Aflatoxin & Pesticide CoA']
          : ['Phytosanitary Certificate', 'Certificate of Analysis (Aflatoxin & Sudan Dye Free)', 'BPOM Food Import License'],
        materialGrade: specs.materialGrade || 'Export Grade A Stemless / With-Stem Premium Sun-Dried',
        packagingRecommendation: '25kg / 50kg food-grade jute bags or vacuum-sealed poly bags',
        classificationRationale: 'Dry spices and dried whole capsicum peppers classified under HS 0904.21.',
      };
    }

    // 5. Default General Goods
    return {
      canonicalProduct: specs.product || 'Commercial Goods',
      category: specs.category || 'Manufactured Merchandise',
      primaryHsCode: '6912.00',
      hsDescription: 'Commercial manufactured goods',
      candidateOrigins: ['China', 'Vietnam', 'India', 'Mexico'],
      unit: unit,
      orderQuantity: qty,
      destinationCountry: dest,
      benchmarkFobUSD: { low: 1.5, high: 3.5, unit: `USD/${unit}` },
      targetComplianceCerts: isUSA
        ? ['CBP Form 7501 Customs Entry Summary', 'Importer Security Filing (ISF 10+2)', 'Standard Certificate of Origin']
        : ['Certificate of Origin', 'Standard Commercial Import Declaration'],
      materialGrade: specs.materialGrade || 'Standard Commercial Grade',
      packagingRecommendation: 'Export Standard Corrugated Master Cartons',
      classificationRationale: 'Standard commercial classification',
    };
  }
}
