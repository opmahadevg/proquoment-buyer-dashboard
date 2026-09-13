import { ModelGateway, INTELLIGENCE_MODEL_CONFIG, getModelFallbackChain } from './model-gateway';
import { ModelChatParams, ModelResponse, ModelStreamEvent, ToolCallPayload } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterAdapter implements ModelGateway {
  private apiKey: string;
  private primaryModel: string;
  private fallbackModel: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.primaryModel = INTELLIGENCE_MODEL_CONFIG.defaultModel;
    this.fallbackModel = INTELLIGENCE_MODEL_CONFIG.fallbackModel;
  }

  private getHeaders(): Record<string, string> {
    const key = this.apiKey || process.env.OPENROUTER_API_KEY || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://proquoment.com',
      'X-Title': 'Proquoment Intelligence',
    };
  }

  async chat(params: ModelChatParams): Promise<ModelResponse> {
    const key = this.apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!key) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const modelsToTry = getModelFallbackChain(params.model);
    let lastError = '';
    let response: Response | null = null;

    for (const modelToTry of modelsToTry) {
      const payload: Record<string, any> = {
        model: modelToTry,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 4096,
      };

      if (params.tools && params.tools.length > 0) {
        payload.tools = params.tools;
        payload.tool_choice = params.toolChoice || 'auto';
      }

      try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          response = res;
          break;
        } else {
          lastError = `Status ${res.status}: ${await res.text()}`;
          console.warn(`OpenRouter model ${modelToTry} failed (${res.status}). Trying next fallback...`);
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`OpenRouter network error on ${modelToTry}: ${lastError}. Trying next fallback...`);
      }
    }

    if (!response || !response.ok) {
      throw new Error(`OpenRouter API error: All models in chain failed. Last error: ${lastError}`);
    }

    const json = await response.json();
    const choice = json.choices?.[0];
    const message = choice?.message;

    return {
      content: message?.content || '',
      toolCalls: message?.tool_calls,
      finishReason: choice?.finish_reason,
      usage: {
        promptTokens: json.usage?.prompt_tokens || 0,
        completionTokens: json.usage?.completion_tokens || 0,
        totalTokens: json.usage?.total_tokens || 0,
      },
    };
  }

  async chatStream(params: ModelChatParams, onEvent: (event: ModelStreamEvent) => void): Promise<void> {
    const key = this.apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!key) {
      onEvent({ type: 'error', error: 'OPENROUTER_API_KEY is not configured' });
      return;
    }

    const modelsToTry = getModelFallbackChain(params.model);
    let streamResponse: Response | null = null;
    let lastError = '';

    for (const modelToTry of modelsToTry) {
      const payload: Record<string, any> = {
        model: modelToTry,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 4096,
        stream: true,
      };

      if (params.tools && params.tools.length > 0) {
        payload.tools = params.tools;
        payload.tool_choice = params.toolChoice || 'auto';
      }

      try {
        const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok && res.body) {
          streamResponse = res;
          break;
        } else {
          lastError = `Status ${res.status}: ${await res.text()}`;
          console.warn(`OpenRouter stream model ${modelToTry} failed (${res.status}). Trying next fallback...`);
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`OpenRouter stream network error on ${modelToTry}: ${lastError}. Trying next fallback...`);
      }
    }

    if (!streamResponse || !streamResponse.body) {
      onEvent({ type: 'error', error: `OpenRouter stream error: All models in chain failed. Last error: ${lastError}` });
      return;
    }

    try {
      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              onEvent({ type: 'chunk', content: delta.content });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name) {
                  onEvent({ type: 'tool_call', toolCall: tc });
                }
              }
            }
          } catch {
            // Ignore partial SSE chunk parse error
          }
        }
      }

      onEvent({ type: 'done' });
    } catch (err: any) {
      onEvent({ type: 'error', error: err?.message || 'Streaming failed' });
    }
  }
}
