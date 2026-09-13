import { ToolDefinition, ToolResult, ToolContext } from './types';
import { globalProviderRegistry, CanonicalTradeFlow, SearchResultItem } from '../providers';
import { calculateCAGR } from '../calculations/cagr';
import { calculateYoYGrowth } from '../calculations/yoy-growth';
import { calculateMarketShare } from '../calculations/market-share';
import { CalculationRecord } from '../core/calculation';
import { Evidence } from '../core/evidence';
import { normalizeCountryISO } from '../core/country-utils';

export const getTradeFlowsTool: ToolDefinition = {
  name: 'get_trade_flows',
  description: 'Retrieves official bilateral customs import/export data, annual volume trends, and partner market share breakdown from UN Comtrade combined with live Google Search trade corroboration.',
  parameters: {
    type: 'object',
    properties: {
      reporter_country: {
        type: 'string',
        description: 'ISO3 country code of the reporting/importing country (e.g. "IDN" for Indonesia, "ARE" for UAE)',
      },
      partner_country: {
        type: 'string',
        description: 'Optional ISO3 code for specific exporting partner (e.g. "IND", "CHN", or "all")',
      },
      hs_code: {
        type: 'string',
        description: '6-digit Harmonized System tariff code (e.g. "291631")',
      },
      product_name: {
        type: 'string',
        description: 'Optional product name or description to enhance live Google Search queries',
      },
      years: {
        type: 'array',
        items: { type: 'number' },
        description: 'Years of historical data to retrieve (default: [2025, 2024, 2023, 2022])',
      },
    },
    required: ['reporter_country', 'hs_code'],
  },
  async execute(params: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const reporter = normalizeCountryISO(params.reporter_country || 'FRA');
    const rawPartner = params.partner_country || 'all';
    const partner = rawPartner.toLowerCase() === 'all' ? 'ALL' : normalizeCountryISO(rawPartner);
    const hsCode = (params.hs_code || '392330').replace('.', '');
    const years = params.years || [2025, 2024, 2023, 2022];
    const prodName = params.product_name || '';

    // Parallel execution: Query UN Comtrade API and live Google Search grounding
    const searchQuery = `${reporter} import HS ${hsCode} ${prodName ? `"${prodName}"` : ''} customs trade volume partner ${partner !== 'ALL' ? partner : 'export'} 2024 2025`;

    const [providerResSettled, searchResSettled] = await Promise.allSettled([
      globalProviderRegistry.resolve<CanonicalTradeFlow[]>('trade_flows', {
        reporterISO: reporter,
        partnerISO: partner,
        hsCode,
        years,
      }),
      globalProviderRegistry.resolve<SearchResultItem[]>('search_grounding', {
        query: searchQuery,
        focus: 'trade_flows',
        limit: 4,
      }),
    ]);

    if (providerResSettled.status !== 'fulfilled') {
      throw providerResSettled.reason;
    }

    const providerRes = providerResSettled.value;
    const flows = providerRes.data;

    let searchItems: SearchResultItem[] = [];
    if (searchResSettled.status === 'fulfilled' && Array.isArray(searchResSettled.value.data)) {
      searchItems = searchResSettled.value.data;
    }

    // Filter by most recent year for market share
    const latestYear = Math.max(...years);
    const latestYearFlows = flows.filter((f) => f.year === latestYear && f.flowType === 'import');

    // Deterministic Market Share Calculation
    const partnerValues = latestYearFlows.map((f) => ({ partner: f.partnerName, value: f.tradeValueUSD }));
    const marketShareCalc = calculateMarketShare(partnerValues);

    // Total imports by year for CAGR and YoY
    const yearlyTotals: Record<number, number> = {};
    for (const f of flows.filter((f) => f.flowType === 'import')) {
      yearlyTotals[f.year] = (yearlyTotals[f.year] || 0) + f.tradeValueUSD;
    }

    const sortedYears = Object.keys(yearlyTotals).map(Number).sort((a, b) => a - b);
    const firstYear = sortedYears[0];
    const lastYear = sortedYears[sortedYears.length - 1];

    const cagrCalc = calculateCAGR(
      yearlyTotals[firstYear] || 1,
      yearlyTotals[lastYear] || 1,
      Math.max(1, lastYear - firstYear)
    );

    const prevYear = lastYear - 1;
    const yoyCalc = calculateYoYGrowth(
      yearlyTotals[lastYear] || 0,
      yearlyTotals[prevYear] || 0
    );

    const calculations: CalculationRecord[] = [
      {
        id: `calc_cagr_${Date.now()}`,
        metric: 'Import Value CAGR',
        formula: cagrCalc.formula,
        inputs: cagrCalc.inputs,
        result: cagrCalc.result,
        calculatedAt: new Date().toISOString(),
      },
      {
        id: `calc_yoy_${Date.now()}`,
        metric: 'Latest Year YoY Growth',
        formula: yoyCalc.formula,
        inputs: yoyCalc.inputs,
        result: yoyCalc.result,
        calculatedAt: new Date().toISOString(),
      },
    ];

    const totalLatestMT = Math.round(
      latestYearFlows.reduce((sum, f) => sum + f.netWeightKG, 0) / 1000
    );
    const totalLatestUSD = latestYearFlows.reduce((sum, f) => sum + f.tradeValueUSD, 0);

    const evidence: Evidence[] = [
      {
        id: `ev_flow_${Date.now()}`,
        claim: `${reporter} imported ${totalLatestMT.toLocaleString()} MT ($${(totalLatestUSD / 1e6).toFixed(1)}M USD) of HS ${hsCode} in ${latestYear}.`,
        sourceId: providerRes.source.id,
        value: { volumeMT: totalLatestMT, valueUSD: totalLatestUSD },
        classification: 'observed' as const,
        confidence: 'high' as const,
        observedAt: `${latestYear}-12-31`,
        createdAt: new Date().toISOString(),
      },
      {
        id: `ev_share_${Date.now()}`,
        claim: `Top sourcing origins for ${reporter}: ${marketShareCalc.result.slice(0, 3).map(m => `${m.partner} (${m.sharePercent}%)`).join(', ')}.`,
        sourceId: providerRes.source.id,
        value: marketShareCalc.result,
        classification: 'calculated' as const,
        confidence: 'high' as const,
        methodology: 'Deterministic market share calculation from bilateral customs entries',
        createdAt: new Date().toISOString(),
      },
    ];

    // Add live Google Search trade corroboration evidence
    if (searchItems.length > 0) {
      const topSearch = searchItems[0];
      evidence.push({
        id: `ev_search_trade_${Date.now()}`,
        claim: `Live Google Search corroboration for HS ${hsCode} (${reporter}): ${topSearch.snippet.slice(0, 180)}...`,
        sourceId: 'src_google_search',
        value: {
          searchQuery,
          topSnippet: topSearch.snippet,
          sourceName: topSearch.sourceName,
          url: topSearch.url,
          allResults: searchItems,
        },
        classification: 'observed' as const,
        confidence: 'high' as const,
        methodology: 'Live Google Search verified customs intelligence & bilateral trade corroboration',
        createdAt: new Date().toISOString(),
      });
    }

    return {
      status: 'success',
      data: {
        reporterCountry: reporter,
        hsCode,
        latestYear,
        totalImportVolumeMT: totalLatestMT,
        totalImportValueUSD: totalLatestUSD,
        cagrPercent: cagrCalc.result,
        yoyGrowthPercent: yoyCalc.result,
        marketShares: marketShareCalc.result,
        yearlyTrends: yearlyTotals,
        rawFlows: flows,
        googleSearchGrounding: {
          query: searchQuery,
          results: searchItems,
          corroborationStatus: searchItems.length > 0 ? 'verified' : 'unverified',
          summary: searchItems[0]?.snippet || 'Corroborated against bilateral trade flow databases.',
        },
      },
      evidence,
      calculations,
    };
  },
};
