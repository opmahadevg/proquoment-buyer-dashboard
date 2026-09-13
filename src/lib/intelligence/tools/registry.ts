import { ToolDefinition, ToolResult, ToolContext } from './types';
import { ToolFunctionDeclaration } from '../ai/types';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toOpenRouterToolDeclarations(): ToolFunctionDeclaration[] {
    return this.getAll().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async execute(name: string, params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        status: 'invalid_input',
        data: null,
        evidence: [],
        errors: [`Tool not found: ${name}`],
      };
    }

    const start = Date.now();
    try {
      const result = await tool.execute(params, context);
      result.providerLatencyMs = Date.now() - start;

      // Asynchronous non-blocking audit logging
      this.logToolRun(name, params, context, result, Date.now() - start).catch(() => {});

      return result;
    } catch (err: any) {
      const duration = Date.now() - start;
      const failResult: ToolResult = {
        status: 'provider_error',
        data: null,
        evidence: [],
        errors: [err?.message || 'Tool execution failed'],
        providerLatencyMs: duration,
      };

      this.logToolRun(name, params, context, failResult, duration).catch(() => {});
      return failResult;
    }
  }

  private async logToolRun(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
    result: ToolResult,
    durationMs: number
  ): Promise<void> {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      if (supabase && context.buyerId) {
        await supabase.from('intelligence_tool_runs').insert({
          buyer_id: context.buyerId,
          workspace_id: context.workspaceId || null,
          session_id: context.sessionId || null,
          tool_name: toolName,
          parameters: params,
          started_at: new Date(Date.now() - durationMs).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          status: result.status,
          error: result.errors?.join(', ') || null,
          result_summary: {
            hasData: Boolean(result.data),
            evidenceCount: result.evidence.length,
            calculationCount: result.calculations?.length || 0,
          },
        });
      }
    } catch {
      // Quiet fail on logging to never block execution
    }
  }
}

export const globalToolRegistry = new ToolRegistry();
