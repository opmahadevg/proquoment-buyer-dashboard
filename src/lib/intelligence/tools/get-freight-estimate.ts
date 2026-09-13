import { ToolDefinition, ToolResult, ToolContext } from './types';
import { globalProviderRegistry } from '../providers';
import { FreightBenchmark } from '../core/logistics-context';

export const getFreightEstimateTool: ToolDefinition = {
  name: 'get_freight_estimate',
  description: 'Calculates an Estimated Freight Benchmark (port-to-port ocean container rates and transit days). Note: This is an analytical benchmark, not a binding freight quote.',
  parameters: {
    type: 'object',
    properties: {
      origin_country_or_port: {
        type: 'string',
        description: 'Exporting origin country or port (e.g. "India", "Nhava Sheva", "China")',
      },
      destination_country_or_port: {
        type: 'string',
        description: 'Importing destination country or port (e.g. "Indonesia", "Jakarta", "UAE")',
      },
      container_type: {
        type: 'string',
        enum: ['20GP', '40GP', '40HC', 'LCL'],
        description: 'Container equipment size',
      },
    },
    required: ['origin_country_or_port', 'destination_country_or_port'],
  },
  async execute(params: Record<string, any>, _context: ToolContext): Promise<ToolResult> {
    const origin = params.origin_country_or_port || params.origin || 'China';
    const dest = params.destination_country_or_port || params.destination || 'Indonesia';
    const container = params.container_type || '20GP';

    const res = await globalProviderRegistry.resolve<FreightBenchmark>('freight', {
      originPortOrCountry: origin,
      destinationPortOrCountry: dest,
      containerType: container,
    });

    const benchmark = res.data;

    return {
      status: 'success',
      data: {
        benchmarkType: 'Estimated Freight Benchmark',
        originPort: benchmark.originPort,
        destinationPort: benchmark.destinationPort,
        containerType: benchmark.containerType,
        estimatedCostMinUSD: benchmark.estimatedCostMin,
        estimatedCostMaxUSD: benchmark.estimatedCostMax,
        transitDaysRange: `${benchmark.transitDaysMin} - ${benchmark.transitDaysMax} days`,
        benchmarkDate: benchmark.benchmarkDate,
        assumptions: benchmark.assumptions,
      },
      evidence: [
        {
          id: `ev_freight_${Date.now()}`,
          claim: `Estimated Freight Benchmark (${benchmark.originPort} → ${benchmark.destinationPort}): $${benchmark.estimatedCostMin} - $${benchmark.estimatedCostMax} USD / ${benchmark.containerType} (~${benchmark.transitDaysMin}-${benchmark.transitDaysMax} days).`,
          sourceId: res.source.id,
          value: benchmark,
          classification: 'calculated',
          confidence: 'medium',
          methodology: 'Calibrated heuristic based on historical Freightos FBX ocean indices',
          createdAt: new Date().toISOString(),
        },
      ],
      dataGaps: [
        {
          id: `gap_freight_${Date.now()}`,
          category: 'logistics',
          description: 'Live spot ocean freight requires actual booking confirmation with freight forwarder.',
          importance: 'low',
          recommendedAction: 'Obtain commercial CIF booking terms from quoting suppliers.',
        },
      ],
    };
  },
};
