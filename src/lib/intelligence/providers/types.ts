import { IntelligenceSource } from '../core/evidence';

export interface ProviderResponse<T> {
  data: T;
  source: IntelligenceSource;
  timestamp: string;
  freshness: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'annual';
  confidence: 'high' | 'medium' | 'low';
  methodology?: string;
}

export interface ProviderConfig {
  priority: number;
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  rateLimit: {
    maxPerMinute: number;
    maxPerDay: number;
  };
  cost: 'free' | 'metered';
  freshness: 'real-time' | 'daily' | 'weekly' | 'monthly' | 'annual';
  coverage: string;
}

export interface ProviderStatus {
  name: string;
  healthy: boolean;
  lastFailure?: string;
  averageLatencyMs: number;
  consecutiveFailures: number;
}

export interface Provider<TParams, TResult> {
  name: string;
  config: ProviderConfig;
  execute(params: TParams): Promise<ProviderResponse<TResult>>;
  healthCheck(): Promise<boolean>;
}
