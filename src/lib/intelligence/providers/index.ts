import { globalProviderRegistry } from './registry';
import { ComtradeProvider } from './comtrade';
import { WitsProvider } from './wits';
import { WtoEpingProvider } from './wto-eping';
import { WorldBankCommodityProvider } from './worldbank-commodities';
import { FreightHeuristicProvider } from './freight-heuristic';
import { ProquomentInternalProvider } from './proquoment-internal';
import { SearchGroundingProvider } from './search-grounding';

export * from './types';
export * from './registry';
export * from './comtrade';
export * from './wits';
export * from './wto-eping';
export * from './worldbank-commodities';
export * from './freight-heuristic';
export * from './proquoment-internal';
export * from './search-grounding';
export * from './web-scraper';

// Initialize and register all core providers
const comtrade = new ComtradeProvider();
const wits = new WitsProvider();
const wto = new WtoEpingProvider();
const wbCommodities = new WorldBankCommodityProvider();
const freight = new FreightHeuristicProvider();
const proquoment = new ProquomentInternalProvider();
const search = new SearchGroundingProvider();

globalProviderRegistry.register('trade_flows', comtrade);
globalProviderRegistry.register('tariffs', wits);
globalProviderRegistry.register('regulatory', wto);
globalProviderRegistry.register('commodities', wbCommodities);
globalProviderRegistry.register('freight', freight);
globalProviderRegistry.register('suppliers', proquoment);
globalProviderRegistry.register('search_grounding', search);
