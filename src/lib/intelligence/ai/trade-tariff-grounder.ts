import { ModelGateway } from './model-gateway';
import { OpenRouterAdapter } from './openrouter-adapter';
import { SourcingClassificationResult } from './sourcing-classifier';

export interface OriginTradeGrounding {
  country: string;
  countryCode: string;
  rank: number;
  effectiveDutyPercent: number;
  dutyLabel: string;
  tradeAgreement: string;
  manufacturingClusters: string[];
  strengths: string[];
  challenges: string[];
  leadTimeDays: string;
  freightPerUnitUSD: number;
  estimatedLandedPerUnitUSD: number;
}

export interface TradeTariffGroundingResult {
  hsCode: string;
  destinationCountry: string;
  rankedOrigins: OriginTradeGrounding[];
  topRecommendedOrigin: OriginTradeGrounding;
  tariffSummary: string;
  tradeRemedyNotes: string[];
}

const TRADE_TARIFF_GROUNDER_SYSTEM_PROMPT = `You are an International Trade Economist & Customs Tariff Attorney specializing in WTO rules, bilateral Free Trade Agreements (FTAs), US Section 301 trade remedies, and global supply chain logistics.

Your task is to evaluate candidate sourcing origin countries for an exact product imported into a destination market, determine statutory applied tariffs, and rank origins by total landed cost and manufacturing agility.

CRITICAL TARIFF & ORIGIN GROUNDING RULES:
1. Destination USA:
   - Ceramic Tableware & Drinkware (HS 6911 / 6912):
     * China: Column 1 MFN (6.0%) + US Section 301 List 3 (+25%) = 31.0% effective applied duty. Epicenters: Chaozhou (porcelain/ceramics capital), Dehua, Zibo. Automated tunnel kilns, high decal precision, but burdened by Section 301.
     * Vietnam: Column 1 MFN (6.0%) without Section 301 punitive tariff. Clusters: Bat Trang (Hanoi), Binh Duong. Low labor costs, growing stoneware capacity.
     * Mexico: 0% preferential tariff under USMCA. Clusters: Puebla, Anahuac. Fast overland trucking (3-5 days to US border), zero ocean demurrage.
     * India: Column 1 MFN (6.0%) (GSP was revoked). Clusters: Khurja (UP), Morbi (Gujarat).
   - Mobile Accessories & TPU Plastics (HS 3926.90):
     * China: 3.4% MFN + 25% Section 301 = 28.4%. Shenzhen/Dongguan injection tooling.
     * Vietnam: 3.4% MFN. Bac Ninh electronics corridor.
     * Mexico: 0% USMCA. Tijuana / Ciudad Juarez.
2. NEVER leak spice copy (Capsicum, Guntur, Byadgi, Scoville heat, oleoresins) into ceramic mugs, tech accessories, or non-spice products.
3. Every strength and advantage MUST be 100% relevant to the specific product being evaluated.

Output strictly valid JSON (no markdown fences):
{
  "hsCode": string,
  "destinationCountry": string,
  "rankedOrigins": [
    {
      "country": string,
      "countryCode": string,
      "rank": number,
      "effectiveDutyPercent": number,
      "dutyLabel": string,
      "tradeAgreement": string,
      "manufacturingClusters": string[],
      "strengths": string[],
      "challenges": string[],
      "leadTimeDays": string,
      "freightPerUnitUSD": number,
      "estimatedLandedPerUnitUSD": number
    }
  ],
  "topRecommendedOrigin": { ... },
  "tariffSummary": string,
  "tradeRemedyNotes": string[]
}
`;

export class TradeTariffGrounder {
  private modelGateway: ModelGateway;

  constructor(modelGateway?: ModelGateway) {
    this.modelGateway = modelGateway || new OpenRouterAdapter();
  }

  async groundTradeAndTariffs(
    classification: SourcingClassificationResult
  ): Promise<TradeTariffGroundingResult> {
    try {
      const resp = await this.modelGateway.chat({
        messages: [
          { role: 'system', content: TRADE_TARIFF_GROUNDER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              PRODUCT: classification.canonicalProduct,
              CATEGORY: classification.category,
              HS_CODE: classification.primaryHsCode,
              DESTINATION: classification.destinationCountry,
              ORDER_QUANTITY: classification.orderQuantity,
              UNIT: classification.unit,
              BENCHMARK_FOB_USD: classification.benchmarkFobUSD,
              CANDIDATE_ORIGINS: classification.candidateOrigins,
            }),
          },
        ],
        temperature: 0.1,
      });

      const cleanJson = resp.content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed.rankedOrigins) && parsed.rankedOrigins.length > 0) {
        return {
          hsCode: parsed.hsCode || classification.primaryHsCode,
          destinationCountry: parsed.destinationCountry || classification.destinationCountry,
          rankedOrigins: parsed.rankedOrigins,
          topRecommendedOrigin: parsed.topRecommendedOrigin || parsed.rankedOrigins[0],
          tariffSummary: parsed.tariffSummary || 'Official bilateral tariff schedule evaluated',
          tradeRemedyNotes: parsed.tradeRemedyNotes || [],
        };
      }
      return this.deterministicGrounding(classification);
    } catch {
      return this.deterministicGrounding(classification);
    }
  }

  public deterministicGrounding(
    classification: SourcingClassificationResult
  ): TradeTariffGroundingResult {
    const isUSA = classification.destinationCountry.toLowerCase().includes('usa') ||
      classification.destinationCountry.toLowerCase().includes('united states');
    const hs = classification.primaryHsCode;
    const isCeramics = hs.startsWith('69') || classification.category.toLowerCase().includes('ceramic');
    const isPlastics = hs.startsWith('39');
    const isToy = hs.startsWith('95');
    const isSpices = hs.startsWith('09');

    const baseFob = classification.benchmarkFobUSD.low || (isCeramics ? 1.5 : isPlastics ? 1.15 : isToy ? 3.2 : 2400);

    const rankedOrigins: OriginTradeGrounding[] = [];

    if (isCeramics) {
      if (isUSA) {
        // China
        rankedOrigins.push({
          country: 'China',
          countryCode: 'CHN',
          rank: 1,
          effectiveDutyPercent: 31.0,
          dutyLabel: '31.0% (Sec 301 + MFN)',
          tradeAgreement: 'US Section 301 List 3 (+25%) + Column 1 MFN (6.0%)',
          manufacturingClusters: ['Chaozhou (Porcelain & Ceramic Capital)', 'Dehua', 'Zibo'],
          strengths: [
            'Global epicenter for ceramic tableware with highest glaze consistency and automated decal kilns',
            'Deepest mold library and fastest custom prototype tooling (7-10 days)',
            'Established food contact testing compliance for high-volume exports',
          ],
          challenges: [
            'Subject to 25% US Section 301 punitive tariff resulting in 31.0% total applied import duty',
            'Trans-Pacific ocean transit window (18-28 days)',
          ],
          leadTimeDays: '18 - 28 days',
          freightPerUnitUSD: 0.32,
          estimatedLandedPerUnitUSD: Math.round((baseFob * 1.31 + 0.32 + 0.05) * 100) / 100,
        });

        // Vietnam
        rankedOrigins.push({
          country: 'Vietnam',
          countryCode: 'VNM',
          rank: 2,
          effectiveDutyPercent: 6.0,
          dutyLabel: '6.0% (MFN Baseline)',
          tradeAgreement: 'US Normal Trade Relations (MFN Column 1 - No Section 301)',
          manufacturingClusters: ['Bat Trang Ceramic Village (Hanoi)', 'Binh Duong'],
          strengths: [
            'Standard 6.0% US MFN duty, saving 25% compared to China Section 301 tariff',
            'Rapidly expanding modern stoneware and artisan pottery export production',
            'Competitive direct shop-floor labor and favorable foreign investment policies',
          ],
          challenges: [
            'Lower total automated kiln capacity compared to Chaozhou mega-clusters',
            'Higher minimum order quantities (MOQ) required for custom colored glazes',
          ],
          leadTimeDays: '20 - 30 days',
          freightPerUnitUSD: 0.35,
          estimatedLandedPerUnitUSD: Math.round((baseFob * 1.06 + 0.35 + 0.05) * 100) / 100,
        });

        // Mexico
        rankedOrigins.push({
          country: 'Mexico',
          countryCode: 'MEX',
          rank: 3,
          effectiveDutyPercent: 0.0,
          dutyLabel: '0% (USMCA FTA)',
          tradeAgreement: 'United States-Mexico-Canada Agreement (USMCA)',
          manufacturingClusters: ['Puebla', 'Anahuac / Monterrey'],
          strengths: [
            '0% duty under USMCA with zero Section 301 exposure',
            'Fast overland cross-border trucking (3-5 days to US distribution centers)',
            'Zero ocean carrier demurrage risk and real-time transit visibility',
          ],
          challenges: [
            'Higher per-unit base FOB price ($1.80 - $2.40/piece) due to higher local operating costs',
            'Smaller volume scalability for mass promotional drinkware campaigns',
          ],
          leadTimeDays: '3 - 5 days (Overland Truck)',
          freightPerUnitUSD: 0.40,
          estimatedLandedPerUnitUSD: Math.round((baseFob * 1.2 * 1.0 + 0.40 + 0.05) * 100) / 100,
        });

        // India
        rankedOrigins.push({
          country: 'India',
          countryCode: 'IND',
          rank: 4,
          effectiveDutyPercent: 6.0,
          dutyLabel: '6.0% (MFN Baseline)',
          tradeAgreement: 'US Normal Trade Relations (MFN Column 1)',
          manufacturingClusters: ['Khurja Ceramic Hub (Uttar Pradesh)', 'Morbi (Gujarat)'],
          strengths: [
            'Standard 6.0% US MFN tariff rate avoiding punitive Section 301 tariffs',
            'Large historic pottery and industrial ceramic clusters with abundant skilled craftspeople',
          ],
          challenges: [
            'Longer maritime transit window to US ports (24-34 calendar days)',
            'Variable automated glaze consistency between small batch workshops',
          ],
          leadTimeDays: '24 - 34 days',
          freightPerUnitUSD: 0.38,
          estimatedLandedPerUnitUSD: Math.round((baseFob * 1.06 + 0.38 + 0.05) * 100) / 100,
        });
      } else {
        // Global / Asian Destination (e.g. Indonesia / UAE)
        rankedOrigins.push({
          country: 'China',
          countryCode: 'CHN',
          rank: 1,
          effectiveDutyPercent: 0.0,
          dutyLabel: '0% (ACFTA Form E)',
          tradeAgreement: 'ASEAN-China Free Trade Area',
          manufacturingClusters: ['Chaozhou', 'Dehua'],
          strengths: ['World largest ceramic export capacity and comprehensive automated kilns'],
          challenges: ['Strict anti-dumping scrutiny in select non-ASEAN jurisdictions'],
          leadTimeDays: '12 - 18 days',
          freightPerUnitUSD: 0.25,
          estimatedLandedPerUnitUSD: Math.round((baseFob + 0.25 + 0.05) * 100) / 100,
        });
        rankedOrigins.push({
          country: 'Vietnam',
          countryCode: 'VNM',
          rank: 2,
          effectiveDutyPercent: 0.0,
          dutyLabel: '0% (ATIGA Form D)',
          tradeAgreement: 'ASEAN Trade in Goods Agreement',
          manufacturingClusters: ['Bat Trang', 'Binh Duong'],
          strengths: ['Intra-ASEAN duty free trade and short transit window'],
          challenges: ['Smaller production capacity compared to Chaozhou'],
          leadTimeDays: '8 - 14 days',
          freightPerUnitUSD: 0.22,
          estimatedLandedPerUnitUSD: Math.round((baseFob + 0.22 + 0.05) * 100) / 100,
        });
      }
    } else if (isPlastics) {
      // Mobile accessories / plastics
      rankedOrigins.push({
        country: 'China',
        countryCode: 'CHN',
        rank: 1,
        effectiveDutyPercent: isUSA ? 28.4 : 0,
        dutyLabel: isUSA ? '28.4% (Sec 301 + MFN)' : '0% FTA',
        tradeAgreement: isUSA ? 'US Section 301 List 3/4 + MFN' : 'Bilateral Trade Agreement',
        manufacturingClusters: ['Shenzhen', 'Dongguan (Pearl River Delta)'],
        strengths: ['Fastest mold modification cycle and deepest optical TPU resin supply chain'],
        challenges: [isUSA ? 'Subject to 25% Section 301 tariff' : 'Supply concentration risk'],
        leadTimeDays: '14 - 25 days',
        freightPerUnitUSD: 0.25,
        estimatedLandedPerUnitUSD: isUSA ? 1.78 : 1.45,
      });
      rankedOrigins.push({
        country: 'Vietnam',
        countryCode: 'VNM',
        rank: 2,
        effectiveDutyPercent: isUSA ? 3.4 : 0,
        dutyLabel: isUSA ? '3.4% MFN Baseline' : '0% FTA',
        tradeAgreement: isUSA ? 'US MFN Schedule' : 'ATIGA',
        manufacturingClusters: ['Bac Ninh', 'Hai Phong'],
        strengths: ['Standard MFN tariff avoiding Section 301 punitive duties'],
        challenges: ['High-precision molds often still imported from China'],
        leadTimeDays: '18 - 28 days',
        freightPerUnitUSD: 0.28,
        estimatedLandedPerUnitUSD: 1.55,
      });
    } else if (isSpices) {
      // Agricultural spices
      rankedOrigins.push({
        country: 'India',
        countryCode: 'IND',
        rank: 1,
        effectiveDutyPercent: 0,
        dutyLabel: isUSA ? '0% MFN (Agricultural)' : '0% AIFTA Form AI',
        tradeAgreement: isUSA ? 'US MFN Schedule' : 'ASEAN-India FTA',
        manufacturingClusters: ['Guntur (Andhra Pradesh)', 'Byadgi (Karnataka)'],
        strengths: ['Global epicenter for Capsicum cultivation with diverse SHU cultivars'],
        challenges: ['Aflatoxin testing and pesticide residue thresholds mandatory'],
        leadTimeDays: '22 - 32 days',
        freightPerUnitUSD: 150,
        estimatedLandedPerUnitUSD: 2650,
      });
    } else {
      // Default manufactured goods
      rankedOrigins.push({
        country: 'China',
        countryCode: 'CHN',
        rank: 1,
        effectiveDutyPercent: isUSA ? 25.0 : 5.0,
        dutyLabel: isUSA ? '25.0% Sec 301 + MFN' : '5.0% MFN',
        tradeAgreement: 'Standard Schedule',
        manufacturingClusters: ['Guangdong Industrial Corridor'],
        strengths: ['Largest global production capacity and integrated supply chain'],
        challenges: [isUSA ? 'US Section 301 tariffs apply' : 'Transit lead time'],
        leadTimeDays: '18 - 28 days',
        freightPerUnitUSD: 0.35,
        estimatedLandedPerUnitUSD: Math.round(baseFob * 1.35 * 100) / 100,
      });
    }

    return {
      hsCode: hs,
      destinationCountry: classification.destinationCountry,
      rankedOrigins,
      topRecommendedOrigin: rankedOrigins[0],
      tariffSummary: isUSA && isCeramics
        ? 'US imports of ceramic tableware from China face 31.0% effective duty (25% Sec 301 + 6% MFN), while Vietnam and India qualify for standard 6.0% MFN, and Mexico achieves 0% duty under USMCA.'
        : 'Bilateral tariffs modeled across candidate global manufacturing origins.',
      tradeRemedyNotes: isUSA && isCeramics
        ? ['US Section 301 List 3 tariff active on Chinese ceramic articles (Heading 6912)']
        : [],
    };
  }
}
