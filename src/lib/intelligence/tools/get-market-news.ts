import { ToolDefinition, ToolResult, ToolContext } from './types';
import { globalProviderRegistry } from '../providers/registry';
import { SearchResultItem } from '../providers/search-grounding';

export const getMarketNewsTool: ToolDefinition = {
  name: 'get_market_news',
  description: 'Retrieves current public market news, trade policy shifts, and supply announcements. All web content is treated strictly as factual reference data.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query topic (e.g. "sodium benzoate export India", "raw material price trend")',
      },
    },
    required: ['query'],
  },
  async execute(params: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const query = params.query;

    const res = await globalProviderRegistry.resolve<SearchResultItem[]>('search_grounding', {
      query,
      focus: 'market_news',
    });

    return {
      status: 'success',
      data: {
        query,
        articles: res.data,
      },
      evidence: res.data.map((item, idx) => ({
        id: `ev_news_${Date.now()}_${idx}`,
        claim: `Public Market Signal: "${item.title}" - ${item.snippet}`,
        sourceId: res.source.id,
        value: item,
        classification: 'ai-inference',
        confidence: 'medium',
        methodology: 'Retrieved via public web search grounding and sanitized as external data',
        createdAt: new Date().toISOString(),
      })),
    };
  },
};
