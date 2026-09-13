import { ModelChatParams, ModelResponse, ModelStreamEvent } from './types';

export interface ModelGateway {
  chat(params: ModelChatParams): Promise<ModelResponse>;
  chatStream(params: ModelChatParams, onEvent: (event: ModelStreamEvent) => void): Promise<void>;
}

export const INTELLIGENCE_MODEL_CONFIG = {
  provider: 'openrouter',
  model: 'openai/gpt-5.6-luna',
  defaultModel: 'openai/gpt-5.6-luna',
  briefingModel: 'openai/gpt-5.6-sol',
  fallbackModel: 'google/gemini-3.8-flash',
  mode: 'intelligence',
};

export function getModelFallbackChain(requestedModel?: string): string[] {
  const primary = requestedModel || INTELLIGENCE_MODEL_CONFIG.defaultModel;
  if (primary === INTELLIGENCE_MODEL_CONFIG.briefingModel) {
    return [
      INTELLIGENCE_MODEL_CONFIG.briefingModel, // openai/gpt-5.6-sol (Briefing only)
      INTELLIGENCE_MODEL_CONFIG.defaultModel,  // openai/gpt-5.6-luna
      INTELLIGENCE_MODEL_CONFIG.fallbackModel, // google/gemini-3.8-flash
    ];
  }
  return [
    primary,                                 // openai/gpt-5.6-luna (All other purposes)
    INTELLIGENCE_MODEL_CONFIG.fallbackModel, // google/gemini-3.8-flash
  ];
}
