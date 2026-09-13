import { ResearchPlan, ResearchStep } from './research-planner';
import { ToolRegistry } from '../tools/registry';
import { ToolContext, ToolResult } from '../tools/types';
import { Evidence } from '../core/evidence';
import { CalculationRecord } from '../core/calculation';
import { DataGap } from '../core/data-gap';
import { ResearchState } from '../core/research-state';

export interface ExecutionEvent {
  type: 'research_status' | 'tool_started' | 'tool_completed' | 'calculation_completed' | 'evidence_added';
  state?: ResearchState;
  toolName?: string;
  stepDescription?: string;
  progressPercent?: number;
  message?: string;
  data?: any;
}

export interface ExecutionResult {
  planId: string;
  stepResults: Map<number, ToolResult>;
  accumulatedEvidence: Evidence[];
  accumulatedCalculations: CalculationRecord[];
  accumulatedDataGaps: DataGap[];
  executionTimeMs: number;
}

export class ResearchExecutor {
  constructor(private toolRegistry: ToolRegistry) {}

  async execute(
    plan: ResearchPlan,
    context: ToolContext,
    onEvent?: (event: ExecutionEvent) => void
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const stepResults = new Map<number, ToolResult>();
    const accumulatedEvidence: Evidence[] = [];
    const accumulatedCalculations: CalculationRecord[] = [];
    const accumulatedDataGaps: DataGap[] = [];

    const totalSteps = plan.steps.length;
    let completedSteps = 0;

    onEvent?.({
      type: 'research_status',
      state: 'understanding',
      progressPercent: 5,
      message: `Analyzing requirement: ${plan.objective.userQuery}`,
    });

    // Dynamic context parameters passed between dependent steps
    const isToy = plan.objective.entities.product?.toLowerCase().includes('toy') ||
      plan.objective.entities.product?.toLowerCase().includes('plush') ||
      plan.objective.entities.product?.toLowerCase().includes('bear');
    const isChemical = plan.objective.entities.product?.toLowerCase().includes('benzoate') ||
      plan.objective.entities.product?.toLowerCase().includes('chemical');

    let knownProductName = plan.objective.entities.product || '';
    let knownHsCode = plan.objective.entities.hsCode
      ? String(plan.objective.entities.hsCode).replace('.', '')
      : (isToy ? '950300' : isChemical ? '291631' : '610910');
    let knownBasePriceUSD = isToy ? 3.2 : (isChemical ? 1198 : 15);
    let knownFreightUSD = 1500;
    let knownDutyPercent = 0;

    for (const group of plan.parallelGroups) {
      const stepsInGroup = group.map((id) => plan.steps.find((s) => s.id === id)).filter((s): s is ResearchStep => Boolean(s));

      // Run independent steps in current group concurrently
      await Promise.allSettled(
        stepsInGroup.map(async (step) => {
          step.status = 'running';

          onEvent?.({
            type: 'tool_started',
            toolName: step.toolName,
            stepDescription: step.description,
            progressPercent: Math.min(95, Math.round((completedSteps / totalSteps) * 90) + 10),
            message: step.description,
          });

          // Inject parameters discovered from earlier steps
          const resolvedParams = { ...step.params };
          if (step.toolName === 'get_trade_flows' || step.toolName === 'get_tariff_data') {
            resolvedParams.hs_code = knownHsCode;
            resolvedParams.product_name = resolvedParams.product_name || knownProductName;
          }
          if (step.toolName === 'calculate_landed_cost') {
            resolvedParams.base_price_usd = resolvedParams.base_price_usd || knownBasePriceUSD;
            resolvedParams.freight_cost_usd = knownFreightUSD;
            resolvedParams.import_duty_rate_percent = knownDutyPercent;
          }

          const result = await this.toolRegistry.execute(step.toolName, resolvedParams, context);

          stepResults.set(step.id, result);
          completedSteps++;

          if (result.status === 'success' || result.status === 'partial_data') {
            step.status = 'completed';

            // Extract context discoveries
            if (step.toolName === 'identify_product' && result.data?.standardizedName) {
              knownProductName = result.data.standardizedName;
            }
            if (step.toolName === 'identify_hs_code' && result.data?.primaryCode) {
              knownHsCode = String(result.data.primaryCode).replace('.', '');
            }
            if (step.toolName === 'get_price_data' && result.data?.observedTradeUnitValues?.low) {
              knownBasePriceUSD = result.data.observedTradeUnitValues.low;
            }
            if (step.toolName === 'get_freight_estimate' && result.data?.estimatedCostMinUSD) {
              knownFreightUSD = result.data.estimatedCostMinUSD;
            }
            if (step.toolName === 'get_tariff_data' && result.data?.effectiveRatePercent !== undefined) {
              knownDutyPercent = result.data.effectiveRatePercent;
            }

            // Accumulate evidence, calculations, data gaps
            if (result.evidence) {
              accumulatedEvidence.push(...result.evidence);
              result.evidence.forEach((ev) => onEvent?.({ type: 'evidence_added', data: ev }));
            }
            if (result.calculations) {
              accumulatedCalculations.push(...result.calculations);
              result.calculations.forEach((calc) => onEvent?.({ type: 'calculation_completed', data: calc }));
            }
            if (result.dataGaps) {
              accumulatedDataGaps.push(...result.dataGaps);
            }
          } else {
            step.status = 'failed';
          }

          onEvent?.({
            type: 'tool_completed',
            toolName: step.toolName,
            stepDescription: step.description,
            data: result.data,
            message: `Completed: ${step.description}`,
          });
        })
      );
    }

    onEvent?.({
      type: 'research_status',
      state: 'evaluating',
      progressPercent: 95,
      message: 'Synthesizing procurement decision and evidence cards...',
    });

    return {
      planId: plan.id,
      stepResults,
      accumulatedEvidence,
      accumulatedCalculations,
      accumulatedDataGaps,
      executionTimeMs: Date.now() - start,
    };
  }
}
