import { IntelligenceSource } from '../core/evidence';

export const KNOWN_SOURCES: Record<string, Omit<IntelligenceSource, 'retrievedAt'>> = {
  comtrade: {
    id: 'src_un_comtrade',
    name: 'UN Comtrade v2 Database',
    publisher: 'United Nations Statistics Division',
    type: 'official',
    url: 'https://comtradeplus.un.org',
    dataPeriod: 'Historical customs import/export data (typically with 3-6 month official lag)',
    license: 'UN Comtrade Terms of Use',
  },
  wits: {
    id: 'src_wits_tariffs',
    name: 'World Integrated Trade Solution (WITS)',
    publisher: 'World Bank / UNCTAD / WTO',
    type: 'official',
    url: 'https://wits.worldbank.org',
    dataPeriod: 'Official MFN and Preferential tariff schedules',
    license: 'Open Data',
  },
  wto_eping: {
    id: 'src_wto_eping',
    name: 'WTO ePing SPS & TBT Platform',
    publisher: 'World Trade Organization',
    type: 'official',
    url: 'https://eping.wto.org',
    dataPeriod: 'Active and proposed sanitary and technical trade barriers',
    license: 'WTO Open Data',
  },
  worldbank_commodities: {
    id: 'src_wb_pinksheet',
    name: 'World Bank Commodity Price Data (The Pink Sheet)',
    publisher: 'World Bank Group',
    type: 'official',
    url: 'https://www.worldbank.org/en/research/commodity-markets',
    dataPeriod: 'Monthly commodity benchmark price averages',
    license: 'CC-BY 4.0',
  },
  freight_benchmark: {
    id: 'src_freight_heuristic',
    name: 'Proquoment Freight Benchmark Index',
    publisher: 'Proquoment Logistics Heuristic Engine',
    type: 'secondary',
    dataPeriod: 'Quarterly updated port-to-port container ocean benchmarks',
    license: 'Proprietary Benchmark Model',
  },
  proquoment_internal: {
    id: 'src_proquoment_db',
    name: 'Proquoment Verified Supplier Network & Historical RFQs',
    publisher: 'Proquoment Platform',
    type: 'transactional',
    dataPeriod: 'Active platform network profiles and verified capabilities',
    license: 'Internal Platform Data',
  },
  web_search: {
    id: 'src_web_grounding',
    name: 'Google Live Search Grounding',
    publisher: 'Google Search Engine & Verified Trade Publications',
    type: 'ai-search',
    url: 'https://www.google.com',
    dataPeriod: 'Real-time public web documents, trade bulletins, and customs notices',
    license: 'Public Web Intelligence',
  },
  web_grounding: {
    id: 'src_web_grounding',
    name: 'Google Live Search Grounding',
    publisher: 'Google Search Engine & Verified Trade Publications',
    type: 'ai-search',
    url: 'https://www.google.com',
    dataPeriod: 'Real-time public web documents, trade bulletins, and customs notices',
    license: 'Public Web Intelligence',
  },
  google_search: {
    id: 'src_google_search',
    name: 'Google Search Intelligence Grounding',
    publisher: 'Google Search Engine & Verified Global Trade Data',
    type: 'ai-search',
    url: 'https://www.google.com',
    dataPeriod: 'Live market search results, commodity reports, and gazettes',
    license: 'Live Web Grounding',
  },
};

export function getOrCreateSource(sourceKey: string, customUrl?: string): IntelligenceSource {
  const template = KNOWN_SOURCES[sourceKey] || {
    id: `src_${sourceKey}`,
    name: sourceKey,
    type: 'secondary' as const,
  };

  return {
    ...template,
    url: customUrl || template.url,
    retrievedAt: new Date().toISOString(),
  };
}
