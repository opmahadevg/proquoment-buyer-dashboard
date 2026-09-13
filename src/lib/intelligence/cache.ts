import { IntelligenceSource } from './core/evidence';

export interface CacheEntry<T = unknown> {
  id: string;
  cacheKey: string;
  provider: string;
  providerVersion: string;
  schemaVersion: string;
  capability: string;
  params: Record<string, unknown>;
  rawResponse?: unknown;
  normalizedResponse: T;
  source: IntelligenceSource;
  createdAt: string;
  expiresAt: string;
  retrievedAt: string;
  hitCount: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<any>>();

export class IntelligenceCache {
  private schemaVersion = '1.0';

  generateKey(capability: string, params: Record<string, unknown>, providerVersion: string = 'v1'): string {
    const sortedKeys = Object.keys(params).sort();
    const normalized: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      const val = params[k];
      normalized[k] = typeof val === 'string' ? val.trim().toLowerCase() : val;
    }
    return `${capability}::${providerVersion}::${JSON.stringify(normalized)}`;
  }

  getTTLHours(capability: string): number {
    switch (capability) {
      case 'trade_flows':
      case 'import_history':
      case 'export_history':
        return 24; // 24 hours
      case 'tariffs':
        return 168; // 7 days
      case 'regulatory':
        return 12; // 12 hours
      case 'commodities':
        return 6; // 6 hours
      case 'freight':
        return 24; // 24 hours
      default:
        return 24;
    }
  }

  async get<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
    // 1. Check in-memory fast cache
    const mem = MEMORY_CACHE.get(cacheKey);
    if (mem) {
      if (new Date(mem.expiresAt) > new Date()) {
        mem.hitCount += 1;
        return mem as CacheEntry<T>;
      } else {
        MEMORY_CACHE.delete(cacheKey);
      }
    }

    // 2. Query Supabase if available
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('intelligence_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (data && !error) {
        const entry: CacheEntry<T> = {
          id: data.id,
          cacheKey: data.cache_key,
          provider: data.provider,
          providerVersion: data.provider_version,
          schemaVersion: data.schema_version,
          capability: data.capability,
          params: data.params,
          rawResponse: data.raw_response,
          normalizedResponse: data.normalized_response,
          source: data.source,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          retrievedAt: data.retrieved_at,
          hitCount: data.hit_count + 1,
        };

        // Populate memory cache
        MEMORY_CACHE.set(cacheKey, entry);

        // Increment hit count asynchronously
        supabase
          .from('intelligence_cache')
          .update({ hit_count: data.hit_count + 1 })
          .eq('id', data.id)
          .then(() => {});

        return entry;
      }
    } catch {
      // Graceful fallback to null
    }

    return null;
  }

  async set<T>(params: {
    capability: string;
    provider: string;
    providerVersion?: string;
    params: Record<string, unknown>;
    rawResponse?: unknown;
    normalizedResponse: T;
    source: IntelligenceSource;
  }): Promise<CacheEntry<T>> {
    const provVer = params.providerVersion || 'v1';
    const key = this.generateKey(params.capability, params.params, provVer);
    const ttl = this.getTTLHours(params.capability);
    const now = new Date();
    const expires = new Date(now.getTime() + ttl * 3600 * 1000);

    const entry: CacheEntry<T> = {
      id: `cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      cacheKey: key,
      provider: params.provider,
      providerVersion: provVer,
      schemaVersion: this.schemaVersion,
      capability: params.capability,
      params: params.params,
      rawResponse: params.rawResponse,
      normalizedResponse: params.normalizedResponse,
      source: params.source,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      retrievedAt: now.toISOString(),
      hitCount: 0,
    };

    // Store in memory
    MEMORY_CACHE.set(key, entry);

    // Try store in Supabase
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      if (supabase) {
        await supabase.from('intelligence_cache').upsert({
          cache_key: key,
          provider: params.provider,
          provider_version: provVer,
          schema_version: this.schemaVersion,
          capability: params.capability,
          params: params.params,
          raw_response: params.rawResponse || null,
          normalized_response: params.normalizedResponse,
          source: params.source,
          created_at: now.toISOString(),
          expires_at: expires.toISOString(),
          retrieved_at: now.toISOString(),
          hit_count: 0,
        }, { onConflict: 'cache_key' });
      }
    } catch {
      // In-memory cache continues to serve
    }

    return entry;
  }
}

export const intelligenceCache = new IntelligenceCache();
