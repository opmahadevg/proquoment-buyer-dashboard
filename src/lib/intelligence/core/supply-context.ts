export interface SupplierProfile {
  id: string;
  name: string;
  country: string;
  category: string;
  verified: boolean;
  productionCapacity?: string;
  estimatedRevenue?: string;
  certifications?: string[];
  exportDestinations?: string[];
  reliabilityScore?: number;
  contactEmail?: string;
  source: 'proquoment_internal' | 'market_research' | 'secondary';
}

export interface SupplyContext {
  originCountries?: string[];
  supplierCount?: number;
  supplierLandscape?: SupplierProfile[];
  productionStrength?: Record<string, unknown>;
  exportStrength?: Record<string, unknown>;
  supplierDepth?: number; // 1-10 rating
  hubLocations?: string[];
  leadTimes?: {
    origin: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  }[];
}
