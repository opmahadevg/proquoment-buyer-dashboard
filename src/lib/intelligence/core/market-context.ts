import { EvidenceReference } from './evidence';

export interface OriginMarketShare {
  countryCode: string;
  countryName: string;
  sharePercent: number;
  importVolume?: number;
  importValue?: number;
  growthRateYoY?: number;
}

export interface MarketContext {
  destinationCountry?: string;
  destinationCountryName?: string;
  destinationPort?: string;
  marketSize?: number;
  importVolume?: number;
  importValue?: number;
  importGrowth?: number;
  importDependency?: number;
  majorOrigins?: OriginMarketShare[];
  demandSignals?: EvidenceReference[];
  historicalTradeFlows?: {
    year: number;
    volume: number;
    value: number;
    topPartner: string;
  }[];
}
