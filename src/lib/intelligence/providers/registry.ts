import { Provider, ProviderConfig, ProviderResponse, ProviderStatus } from './types';

export class ProviderRegistry {
  private providersByCapability = new Map<string, Provider<any, any>[]>();
  private statusMap = new Map<string, ProviderStatus>();

  register<TParams, TResult>(
    capability: string,
    provider: Provider<TParams, TResult>
  ): void {
    const list = this.providersByCapability.get(capability) || [];
    list.push(provider);
    // Sort descending by priority
    list.sort((a, b) => b.config.priority - a.config.priority);
    this.providersByCapability.set(capability, list);

    if (!this.statusMap.has(provider.name)) {
      this.statusMap.set(provider.name, {
        name: provider.name,
        healthy: true,
        averageLatencyMs: 0,
        consecutiveFailures: 0,
      });
    }
  }

  getProvidersForCapability(capability: string): Provider<any, any>[] {
    return this.providersByCapability.get(capability) || [];
  }

  getProviderStatus(providerName: string): ProviderStatus | undefined {
    return this.statusMap.get(providerName);
  }

  recordProviderSuccess(providerName: string, durationMs: number): void {
    const st = this.statusMap.get(providerName);
    if (st) {
      st.healthy = true;
      st.consecutiveFailures = 0;
      st.averageLatencyMs = st.averageLatencyMs === 0 ? durationMs : Math.round((st.averageLatencyMs * 0.8) + (durationMs * 0.2));
    }
  }

  recordProviderFailure(providerName: string, error: Error): void {
    const st = this.statusMap.get(providerName);
    if (st) {
      st.consecutiveFailures += 1;
      st.lastFailure = error.message;
      if (st.consecutiveFailures >= 3) {
        st.healthy = false;
      }
    }
  }

  async resolve<TResult>(capability: string, params: any): Promise<ProviderResponse<TResult>> {
    const providers = this.getProvidersForCapability(capability);
    if (providers.length === 0) {
      throw new Error(`No provider registered for capability: ${capability}`);
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      const status = this.getProviderStatus(provider.name);
      if (status && !status.healthy && status.consecutiveFailures > 5) {
        continue; // skip unhealthy provider temporarily
      }

      const start = Date.now();
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${provider.config.timeoutMs}ms`)), provider.config.timeoutMs)
        );

        const result = await Promise.race([provider.execute(params), timeoutPromise]);
        this.recordProviderSuccess(provider.name, Date.now() - start);
        return result;
      } catch (err: any) {
        this.recordProviderFailure(provider.name, err);
        lastError = err;
        console.warn(`Provider ${provider.name} failed for ${capability}:`, err.message);
      }
    }

    throw lastError || new Error(`All providers failed for capability: ${capability}`);
  }

  async resolveAll<TResult>(capability: string, params: any): Promise<ProviderResponse<TResult>[]> {
    const providers = this.getProvidersForCapability(capability);
    const results: ProviderResponse<TResult>[] = [];

    await Promise.allSettled(
      providers.map(async (p) => {
        try {
          const res = await p.execute(params);
          results.push(res);
        } catch {
          // Ignore individual failures in multi-resolve
        }
      })
    );

    return results;
  }
}

export const globalProviderRegistry = new ProviderRegistry();
