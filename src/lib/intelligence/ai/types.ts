export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCallPayload[];
}

export interface ToolCallPayload {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON encoded string
  };
}

export interface ToolFunctionDeclaration {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ModelChatParams {
  messages: ChatMessage[];
  tools?: ToolFunctionDeclaration[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCallPayload[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type ModelStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallPayload }
  | { type: 'done' }
  | { type: 'error'; error: string };
