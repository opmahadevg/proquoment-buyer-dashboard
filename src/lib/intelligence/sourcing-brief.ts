import { SourcingObject } from './core/sourcing-object';
import { ProductContext } from './core/product-context';
import { MarketContext } from './core/market-context';
import { PriceRange } from './core/economics-context';
import { Assumption, DataGap } from './core/data-gap';
import { normalizeToPerPiece } from './calculations/price-normalizer';

export type FieldClassification =
  | 'buyer_provided'
  | 'ai_suggested'
  | 'research_indicates'
  | 'buyer_specified'
  | 'unknown';

export interface ClassifiedField<T = any> {
  value: T;
  classification: FieldClassification;
  confidence: 'high' | 'medium' | 'low';
  provenance?: string;
  userOverridden?: boolean;
}

export interface SourcingBrief {
  id: string;
  workspaceId: string;
  product: ClassifiedField<ProductContext>;
  quantity?: ClassifiedField<number>;
  unit?: ClassifiedField<string>;
  destination: ClassifiedField<MarketContext>;
  preferredOrigins: ClassifiedField<string[]>;
  specifications: ClassifiedField<Record<string, unknown>>;
  historicalPriceBenchmark?: ClassifiedField<PriceRange | undefined>;
  incoterm: ClassifiedField<string>;
  complianceRequirements: ClassifiedField<string[]>;
  supplierRequirements: ClassifiedField<string[]>;
  sourcingContext: string;
  intelligenceSummary: string;
  evidenceIds: string[];
  assumptions: Assumption[];
  dataGaps: DataGap[];
  rfqReadyScore: number;
}

export function generateSourcingBrief(sourcingObj: SourcingObject): SourcingBrief {
  const product = sourcingObj.product;
  const market = sourcingObj.market;
  const supply = sourcingObj.supply;
  const compliance = sourcingObj.compliance;
  const logistics = sourcingObj.logistics;
  const economics = sourcingObj.economics;

  // Compute readiness score
  let readyScore = 30; // base for having product & destination
  if (product.primaryHSCode) readyScore += 20;
  if (compliance.requiredCertifications && compliance.requiredCertifications.length > 0) readyScore += 15;
  if (supply.originCountries && supply.originCountries.length > 0) readyScore += 15;
  if (logistics.recommendedIncoterms && logistics.recommendedIncoterms.length > 0) readyScore += 10;
  if (economics.observedTradeUnitValues) readyScore += 10;

  const briefId = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: briefId,
    workspaceId: sourcingObj.workspaceId,
    product: {
      value: product,
      classification: product.primaryHSCode ? 'research_indicates' : 'buyer_provided',
      confidence: 'high',
      provenance: product.primaryHSCode ? `HS: ${product.primaryHSCode}` : undefined,
    },
    destination: {
      value: market,
      classification: 'buyer_provided',
      confidence: 'high',
      provenance: market.destinationCountry,
    },
    preferredOrigins: {
      value: supply.originCountries || [],
      classification: supply.originCountries?.length ? 'research_indicates' : 'unknown',
      confidence: supply.originCountries?.length ? 'high' : 'low',
    },
    specifications: {
      value: product.specifications || {},
      classification: product.specifications && Object.keys(product.specifications).length ? 'buyer_provided' : 'unknown',
      confidence: 'medium',
    },
    historicalPriceBenchmark: economics.observedTradeUnitValues ? {
      value: economics.observedTradeUnitValues,
      classification: 'research_indicates',
      confidence: 'high',
      provenance: (() => {
        const avg = (economics.observedTradeUnitValues.low + economics.observedTradeUnitValues.high) / 2;
        const perPiece = normalizeToPerPiece(avg || 0, product.canonicalName);
        return perPiece
          ? `UN Comtrade (bulk MT basis — per-piece normalization: ~$${perPiece.pricePerPieceUSD}/piece)`
          : 'UN Comtrade historical trade unit values';
      })(),
    } : undefined,
    incoterm: {
      value: logistics.recommendedIncoterms?.[0] || 'CIF',
      classification: 'ai_suggested',
      confidence: 'medium',
      provenance: 'Logistics benchmark recommendation',
    },
    complianceRequirements: {
      value: compliance.requiredCertifications || [],
      classification: 'research_indicates',
      confidence: 'medium',
      provenance: 'WTO ePing and standards agency records',
    },
    supplierRequirements: {
      value: ['Verified ISO/GMP manufacturing capacity', 'Direct export capabilities'],
      classification: 'ai_suggested',
      confidence: 'medium',
    },
    sourcingContext: `Intelligence-backed sourcing inquiry for ${product.canonicalName} delivered to ${market.destinationCountry || 'destination'}.`,
    intelligenceSummary: `Research completed for ${product.canonicalName}. Evaluated historical import flows, compliance barriers, and origin options. Target price left for buyer entry in RFQ.`,
    evidenceIds: sourcingObj.evidenceIds || [],
    assumptions: sourcingObj.assumptions || [],
    dataGaps: sourcingObj.dataGaps || [],
    rfqReadyScore: Math.min(100, readyScore),
  };
}
