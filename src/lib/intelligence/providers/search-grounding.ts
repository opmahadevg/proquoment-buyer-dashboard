import { Provider, ProviderConfig, ProviderResponse } from './types';
import { getOrCreateSource } from '../evidence/source-registry';
import { intelligenceCache } from '../cache';

export interface SearchQueryParams {
  query: string;
  focus?: 'market_news' | 'regulations' | 'suppliers' | 'trade_policies' | 'tariffs' | 'commodities' | 'trade_flows';
  limit?: number;
}

export interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  publishedDate?: string;
  sourceName: string;
}

export class SearchGroundingProvider implements Provider<SearchQueryParams, SearchResultItem[]> {
  name = 'Google Search Grounding';
  config: ProviderConfig = {
    priority: 85,
    timeoutMs: 9000,
    retryPolicy: { maxRetries: 2, backoffMs: 600 },
    rateLimit: { maxPerMinute: 60, maxPerDay: 2000 },
    cost: 'free',
    freshness: 'real-time',
    coverage: 'Global live Google web search, official trade gazettes, customs notifications, and commodity exchanges',
  };

  async execute(params: SearchQueryParams): Promise<ProviderResponse<SearchResultItem[]>> {
    const cacheKey = intelligenceCache.generateKey('search_grounding', params as any);
    const cached = await intelligenceCache.get<SearchResultItem[]>(cacheKey);
    if (cached) {
      return {
        data: cached.normalizedResponse,
        source: cached.source,
        timestamp: cached.retrievedAt,
        freshness: 'daily',
        confidence: 'high',
        methodology: 'Cached Google Search intelligence grounding',
      };
    }

    const source = getOrCreateSource('google_search');
    const limit = Math.min(params.limit || 6, 10);
    let results: SearchResultItem[] = [];
    let methodology = 'Google Live Search Grounding';

    // Tier 1: SerpAPI Google Search (uses SERPAPI_KEY from environment)
    const serpApiKey = process.env.SERPAPI_KEY;
    if (serpApiKey && results.length === 0) {
      try {
        const serpUrl = new URL('https://serpapi.com/search.json');
        serpUrl.searchParams.set('engine', 'google');
        serpUrl.searchParams.set('q', params.query);
        serpUrl.searchParams.set('num', String(limit));
        serpUrl.searchParams.set('api_key', serpApiKey);

        const res = await fetch(serpUrl.toString(), {
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          const organic = data.organic_results || [];
          if (Array.isArray(organic) && organic.length > 0) {
            results = organic.slice(0, limit).map((r: any) => ({
              title: r.title || 'Google Search Result',
              snippet: r.snippet || r.description || '',
              url: r.link || `https://www.google.com/search?q=${encodeURIComponent(params.query)}`,
              publishedDate: r.date || new Date().toISOString().slice(0, 10),
              sourceName: r.source || (r.link ? new URL(r.link).hostname.replace(/^www\./, '') : 'Google Search'),
            }));
            methodology = 'Live Google Search via SerpAPI';
          }
        }
      } catch (err) {
        console.warn('SerpAPI Google Search query error, trying next tier:', err);
      }
    }

    // Tier 1B: Brave Search API (uses BRAVE_SEARCH_API_KEY from environment)
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveApiKey && results.length === 0) {
      try {
        const braveUrl = new URL('https://api.search.brave.com/res/v1/web/search');
        braveUrl.searchParams.set('q', params.query);
        braveUrl.searchParams.set('count', String(limit));

        const res = await fetch(braveUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': braveApiKey,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          const webResults = data.web?.results || [];
          if (Array.isArray(webResults) && webResults.length > 0) {
            results = webResults.slice(0, limit).map((r: any) => ({
              title: r.title || 'Brave Web Result',
              snippet: r.description || '',
              url: r.url || '',
              publishedDate: r.page_age || new Date().toISOString().slice(0, 10),
              sourceName: r.meta_url?.hostname || 'Brave Search',
            }));
            methodology = 'Live Web Search via Brave Search API';
          }
        }
      } catch (err) {
        console.warn('Brave Search query error, trying next tier:', err);
      }
    }

    // Tier 2: Google Custom Search JSON API
    const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CSE_ID;
    if (googleApiKey && googleCx && results.length === 0) {
      try {
        const cseUrl = new URL('https://www.googleapis.com/customsearch/v1');
        cseUrl.searchParams.set('key', googleApiKey);
        cseUrl.searchParams.set('cx', googleCx);
        cseUrl.searchParams.set('q', params.query);
        cseUrl.searchParams.set('num', String(limit));

        const res = await fetch(cseUrl.toString(), {
          cache: 'no-store',
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          if (Array.isArray(items) && items.length > 0) {
            results = items.slice(0, limit).map((item: any) => ({
              title: item.title || 'Google Search Result',
              snippet: item.snippet || '',
              url: item.link || '',
              publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString().slice(0, 10),
              sourceName: item.displayLink || (item.link ? new URL(item.link).hostname.replace(/^www\./, '') : 'Google Search'),
            }));
            methodology = 'Live Google Custom Search JSON API';
          }
        }
      } catch (err) {
        console.warn('Google Custom Search API error, trying next tier:', err);
      }
    }

    // Tier 3: DuckDuckGo / Public Web Search Fallback
    if (results.length === 0) {
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`;
        const res = await fetch(ddgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const html = await res.text();
          const parsed = this.parseDuckDuckGoHtml(html, limit);
          if (parsed.length > 0) {
            results = parsed;
            methodology = 'Live Web Search Grounding';
          }
        }
      } catch (err) {
        console.warn('Web search fallback error, proceeding to curated intelligence synthesis:', err);
      }
    }

    // Tier 4: Transparent fallback when no live search hits are found
    if (results.length === 0) {
      methodology = 'No real-time search results found for query';
    }

    await intelligenceCache.set({
      capability: 'search_grounding',
      provider: this.name,
      params: params as any,
      normalizedResponse: results,
      source,
    });

    return {
      data: results,
      source,
      timestamp: new Date().toISOString(),
      freshness: 'real-time',
      confidence: results.length > 0 ? 'high' : 'low',
      methodology,
    };
  }

  private parseDuckDuckGoHtml(html: string, limit: number): SearchResultItem[] {
    const results: SearchResultItem[] = [];
    const regex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null && results.length < limit) {
      let rawUrl = match[1] || '';
      if (rawUrl.includes('uddg=')) {
        try {
          const u = new URL('https://duckduckgo.com' + rawUrl);
          rawUrl = decodeURIComponent(u.searchParams.get('uddg') || rawUrl);
        } catch {
          // ignore parsing error
        }
      }

      const snippet = (match[2] || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
      let hostname = 'web-intelligence.org';
      try {
        hostname = new URL(rawUrl).hostname.replace(/^www\./, '');
      } catch {
        // fallback hostname
      }

      if (snippet && rawUrl) {
        results.push({
          title: `Trade Intelligence: ${hostname}`,
          snippet,
          url: rawUrl,
          publishedDate: new Date().toISOString().slice(0, 10),
          sourceName: hostname,
        });
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
