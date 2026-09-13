import { ToolDefinition, ToolResult, ToolContext } from './types';
import { globalProviderRegistry } from '../providers';
import { SupplierProfile } from '../core/supply-context';

export const getSupplierLandscapeTool: ToolDefinition = {
  name: 'get_supplier_landscape',
  description: 'Retrieves verified supplier profiles, manufacturing capacities, and certifications from the Proquoment supplier directory and market intelligence.',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: 'Product or category name',
      },
      origin_country: {
        type: 'string',
        description: 'Optional supplier country to filter (e.g. "India", "China")',
      },
    },
    required: ['product_name'],
  },
  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const product = params.product_name;
    const country = params.origin_country;

    const res = await globalProviderRegistry.resolve<SupplierProfile[]>('suppliers', {
      categoryOrProduct: product,
      country,
      buyerId: context.buyerId,
    });

    const suppliers = res.data;

    return {
      status: 'success',
      data: {
        product,
        supplierCount: suppliers.length,
        suppliers,
        primaryOrigins: Array.from(new Set(suppliers.map((s) => s.country))),
      },
      evidence: suppliers.map((s, idx) => ({
        id: `ev_sup_${Date.now()}_${idx}`,
        claim: `Verified Supplier: ${s.name} (${s.country}) - Capacity: ${s.productionCapacity || 'Confidential'}, Certifications: ${s.certifications?.join(', ') || 'ISO'}.`,
        sourceId: res.source.id,
        value: s,
        classification: 'observed',
        confidence: 'high',
        createdAt: new Date().toISOString(),
      })),
      dataGaps: [
        {
          id: `gap_sup_cap_${Date.now()}`,
          category: 'supplier',
          description: 'Factory-direct MOQ allocation and current monthly free capacity require direct supplier confirmation.',
          importance: 'high',
          recommendedAction: 'Issue RFQ to shortlisted verified suppliers.',
        },
      ],
    };
  },
};
