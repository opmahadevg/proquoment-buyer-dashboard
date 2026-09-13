import { ProductContext } from './product-context';
import { MarketContext } from './market-context';
import { SupplyContext } from './supply-context';
import { EconomicsContext } from './economics-context';
import { ComplianceContext } from './compliance-context';
import { LogisticsContext } from './logistics-context';
import { DecisionContext } from './decision-context';
import { Assumption, DataGap } from './data-gap';

export interface SourcingObject {
  id: string;
  workspaceId: string;
  buyerId: string;

  product: ProductContext;
  market: MarketContext;
  supply: SupplyContext;
  economics: EconomicsContext;
  compliance: ComplianceContext;
  logistics: LogisticsContext;

  decision?: DecisionContext;

  assumptions: Assumption[];
  dataGaps: DataGap[];
  evidenceIds: string[];

  createdAt: string;
  updatedAt: string;
}

export function createEmptySourcingObject(params: {
  id: string;
  workspaceId: string;
  buyerId: string;
  productName: string;
  destinationCountry: string;
  hsCode?: string;
}): SourcingObject {
  const now = new Date().toISOString();
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    buyerId: params.buyerId,
    product: {
      canonicalName: params.productName,
      primaryHSCode: params.hsCode,
    },
    market: {
      destinationCountry: params.destinationCountry,
    },
    supply: {},
    economics: {},
    compliance: {
      destinationCountry: params.destinationCountry,
    },
    logistics: {},
    assumptions: [],
    dataGaps: [],
    evidenceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
