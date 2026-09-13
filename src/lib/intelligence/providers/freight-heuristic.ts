import { Provider, ProviderConfig, ProviderResponse } from './types';
import { getOrCreateSource } from '../evidence/source-registry';
import { FreightBenchmark } from '../core/logistics-context';
import { intelligenceCache } from '../cache';

export interface FreightQueryParams {
  originPortOrCountry: string; // e.g. "Nhava Sheva, India" or "IND"
  destinationPortOrCountry: string; // e.g. "Jakarta, Indonesia" or "IDN"
  containerType?: '20GP' | '40GP' | '40HC' | 'LCL';
}

export class FreightHeuristicProvider implements Provider<FreightQueryParams, FreightBenchmark> {
  name = 'Freight Heuristic Engine';
  config: ProviderConfig = {
    priority: 80,
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 1, backoffMs: 200 },
    rateLimit: { maxPerMinute: 120, maxPerDay: 10000 },
    cost: 'free',
    freshness: 'daily',
    coverage: 'Major global ocean shipping corridors based on Freightos FBX public benchmarks',
  };

  async execute(params: FreightQueryParams): Promise<ProviderResponse<FreightBenchmark>> {
    const cacheKey = intelligenceCache.generateKey('freight', params as any);
    const cached = await intelligenceCache.get<FreightBenchmark>(cacheKey);
    if (cached) {
      return {
        data: cached.normalizedResponse,
        source: cached.source,
        timestamp: cached.retrievedAt,
        freshness: 'daily',
        confidence: 'medium',
        methodology: 'Cached from Proquoment Freight Heuristic Model',
      };
    }

    const source = getOrCreateSource('freight_benchmark');

    const origin = (params.originPortOrCountry || 'India').toUpperCase();
    const dest = (params.destinationPortOrCountry || 'Indonesia').toUpperCase();
    const container = params.containerType || '20GP';

    let minUSD = 1200;
    let maxUSD = 1600;
    let daysMin = 14;
    let daysMax = 20;
    let originPort = 'Nhava Sheva (INNSA), India';
    let destPort = 'Tanjung Priok (IDTPP), Jakarta, Indonesia';

    if (dest.includes('USA') || dest.includes('UNITED STATES') || dest.includes('US')) {
      destPort = 'Port of Los Angeles / Long Beach (USLAX), USA';
      if (origin.includes('CHN') || origin.includes('CHINA') || origin.includes('SHANGHAI')) {
        originPort = 'Shanghai / Shenzhen / Ningbo, China';
        minUSD = 2100;
        maxUSD = 3100;
        daysMin = 16;
        daysMax = 22;
      } else if (origin.includes('VNM') || origin.includes('VIETNAM')) {
        originPort = 'Haiphong / Cat Lai, Vietnam';
        minUSD = 2200;
        maxUSD = 3200;
        daysMin = 18;
        daysMax = 24;
      } else if (origin.includes('MEX') || origin.includes('MEXICO')) {
        originPort = 'Manzanillo / Nuevo Laredo overland, Mexico';
        destPort = 'Laredo / Dallas Inland Hub, USA';
        minUSD = 950;
        maxUSD = 1600;
        daysMin = 3;
        daysMax = 6;
      } else if (origin.includes('IND') || origin.includes('INDIA')) {
        originPort = 'Nhava Sheva (INNSA), India';
        destPort = 'Port of New York / New Jersey (USNYC), USA';
        minUSD = 2700;
        maxUSD = 3800;
        daysMin = 24;
        daysMax = 32;
      } else {
        minUSD = 2200;
        maxUSD = 3200;
        daysMin = 18;
        daysMax = 25;
      }
    } else if (dest.includes('ARE') || dest.includes('UAE') || dest.includes('DUBAI')) {
      destPort = 'Jebel Ali (AEJEA), Dubai, UAE';
      if (origin.includes('IND') || origin.includes('INDIA')) {
        originPort = 'Nhava Sheva (INNSA), India';
        minUSD = 850;
        maxUSD = 1200;
        daysMin = 5;
        daysMax = 8;
      } else if (origin.includes('CHN') || origin.includes('CHINA')) {
        originPort = 'Shanghai (CNSHA), China';
        minUSD = 1400;
        maxUSD = 1900;
        daysMin = 14;
        daysMax = 18;
      }
    } else {
      // Default to ASEAN / Indonesia corridor
      if (origin.includes('CHN') || origin.includes('CHINA') || origin.includes('SHANGHAI')) {
        originPort = 'Shanghai (CNSHA), China';
        minUSD = 900;
        maxUSD = 1300;
        daysMin = 10;
        daysMax = 15;
      } else if (origin.includes('IND') || origin.includes('INDIA') || origin.includes('MUMBAI')) {
        originPort = 'Nhava Sheva (INNSA), India';
        minUSD = 1300;
        maxUSD = 1750;
        daysMin = 14;
        daysMax = 21;
      }
    }

    if (container === '40HC' || container === '40GP') {
      minUSD = Math.round(minUSD * 1.6);
      maxUSD = Math.round(maxUSD * 1.6);
    }

    const benchmark: FreightBenchmark = {
      originPort,
      destinationPort: destPort,
      containerType: container,
      estimatedCostMin: minUSD,
      estimatedCostMax: maxUSD,
      currency: 'USD',
      transitDaysMin: daysMin,
      transitDaysMax: daysMax,
      benchmarkDate: new Date().toISOString().slice(0, 10),
      confidence: 'medium',
      assumptions: [
        'Port-to-port ocean container freight only (FCL)',
        'Excludes destination terminal handling charges (THC) and customs clearance',
        'Subject to bunker adjustment factor (BAF) and seasonal peak surcharges',
      ],
    };

    await intelligenceCache.set({
      capability: 'freight',
      provider: this.name,
      params: params as any,
      normalizedResponse: benchmark,
      source,
    });

    return {
      data: benchmark,
      source,
      timestamp: new Date().toISOString(),
      freshness: 'daily',
      confidence: 'medium',
      methodology: 'Calibrated heuristic port-pair lookup based on historical Freightos FBX ocean indices',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
