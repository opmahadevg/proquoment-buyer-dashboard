export interface RegulatoryNotification {
  id: string;
  source: string; // e.g. "WTO ePing"
  country: string;
  type: 'SPS' | 'TBT' | 'Tariff' | 'Quota' | 'Sanction' | 'Standard';
  title: string;
  description: string;
  date: string;
  mandatory: boolean;
  status: 'active' | 'proposed' | 'withdrawn';
}

export interface TariffDetail {
  reporterCountry: string;
  partnerCountry?: string;
  hsCode: string;
  mfnRatePercent: number;
  preferentialRatePercent?: number;
  agreementName?: string;
  effectiveYear: number;
}

export interface ComplianceContext {
  destinationCountry?: string;
  tariffs?: TariffDetail[];
  spsTbtMeasures?: RegulatoryNotification[];
  requiredCertifications?: string[];
  restrictedItems?: string[];
  importLicensingRequired?: boolean;
  standardsAgencies?: string[]; // e.g. "BPOM", "BIS", "FDA", "CE"
  summaryOfBarriers?: string;
}
