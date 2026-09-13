import { Evidence } from '../core/evidence';
import { CalculationRecord } from '../core/calculation';
import { DataGap } from '../core/data-gap';
import { ToolFunctionDeclaration } from '../ai/types';

export type ToolStatus =
  | 'success'
  | 'no_data'
  | 'partial_data'
  | 'provider_error'
  | 'invalid_input'
  | 'timeout'
  | 'rate_limited'
  | 'unsupported_country'
  | 'unsupported_product';

export interface ToolContext {
  buyerId: string;
  workspaceId?: string;
  sessionId?: string;
}

export interface ToolResult {
  status: ToolStatus;
  data: any;
  evidence: Evidence[];
  calculations?: CalculationRecord[];
  dataGaps?: DataGap[];
  missing?: string[];
  errors?: string[];
  providerLatencyMs?: number;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult>;
}
