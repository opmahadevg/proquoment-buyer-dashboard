import { ToolDefinition, ToolResult, ToolContext } from './types';
import { calculateLandedCost, LandedCostInput } from '../calculations/landed-cost';
import { CalculationRecord } from '../core/calculation';

export const calculateLandedCostTool: ToolDefinition = {
  name: 'calculate_landed_cost',
  description: 'Deterministically calculates full estimated landed cost per unit and total order (FOB price + ocean freight + marine insurance + customs import duty + VAT/sales tax + port handling).',
  parameters: {
    type: 'object',
    properties: {
      base_price_usd: {
        type: 'number',
        description: 'Base FOB price per unit in USD (from observed customs data or quote)',
      },
      quantity: {
        type: 'number',
        description: 'Order quantity (default: 1)',
      },
      unit: {
        type: 'string',
        description: 'Unit of measure (e.g. "MT", "KG", "units")',
      },
      freight_cost_usd: {
        type: 'number',
        description: 'Total ocean freight estimate in USD',
      },
      import_duty_rate_percent: {
        type: 'number',
        description: 'Applied import tariff duty percentage (e.g. 0, 5, 10)',
      },
      vat_rate_percent: {
        type: 'number',
        description: 'Import VAT / goods tax percentage (e.g. 10, 11)',
      },
      port_handling_usd: {
        type: 'number',
        description: 'Estimated port clearance and documentation fee in USD',
      },
    },
    required: ['base_price_usd', 'freight_cost_usd'],
  },
  async execute(params: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const input: LandedCostInput = {
      basePriceUSD: Number(params.base_price_usd),
      quantity: Number(params.quantity) || 1,
      unit: params.unit || 'MT',
      freightCostUSD: Number(params.freight_cost_usd) || 1500,
      importDutyRatePercent: params.import_duty_rate_percent !== undefined ? Number(params.import_duty_rate_percent) : 5,
      vatOrSalesTaxPercent: params.vat_rate_percent !== undefined ? Number(params.vat_rate_percent) : 11,
      portHandlingCostUSD: params.port_handling_usd !== undefined ? Number(params.port_handling_usd) : 200,
      insuranceRatePercent: 0.3,
    };

    const calcResult = calculateLandedCost(input);
    const breakdown = calcResult.result;

    const calcRecord: CalculationRecord = {
      id: `calc_landed_${Date.now()}`,
      metric: 'Landed Cost Per Unit',
      formula: calcResult.formula,
      inputs: calcResult.inputs,
      result: breakdown,
      calculatedAt: new Date().toISOString(),
    };

    return {
      status: 'success',
      data: breakdown,
      evidence: [
        {
          id: `ev_landed_${Date.now()}`,
          claim: `Calculated Landed Cost: $${breakdown.landedCostPerUnitUSD.toLocaleString()} USD/${input.unit} (+${breakdown.landedCostDeltaPercent}% over base FOB of $${input.basePriceUSD}). Total Order Landed: $${breakdown.totalLandedCostUSD.toLocaleString()} USD.`,
          sourceId: 'src_freight_heuristic',
          value: breakdown,
          classification: 'calculated',
          confidence: 'high',
          methodology: 'Deterministic landed cost formula adding FOB, freight benchmark, insurance, import duty, VAT, and port handling',
          createdAt: new Date().toISOString(),
        },
      ],
      calculations: [calcRecord],
    };
  },
};
