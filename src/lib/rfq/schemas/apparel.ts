import { CategorySchema } from './types';

export const apparelSchema: CategorySchema = {
  id: 'apparel',
  name: 'Apparel & Textiles',
  fields: {
    'product.name': {
      requirement: 'required',
      label: 'Product Name',
    },
    'quantity.value': {
      requirement: 'required',
      label: 'Total Quantity',
    },
    'specifications.fabric_composition': {
      requirement: 'required',
      label: 'Fabric Composition',
      options: ['100% Cotton', 'Polyester Blend', 'Nylon', 'Spandex/Elastane', 'Linen'],
      ai_prompt_hint: 'If they just say "cotton", ask if they need organic cotton or a specific weight (GSM).'
    },
    'specifications.fabric_weight_gsm': {
      requirement: 'recommended',
      label: 'Fabric Weight (GSM)',
    },
    'specifications.size_range': {
      requirement: 'required',
      label: 'Size Range & Breakdown',
      description: 'e.g. S-XXL, and ratio (e.g. 1:2:2:1)'
    },
    'manufacturing.printing_method': {
      requirement: 'optional',
      label: 'Printing/Embroidery Method',
      options: ['Screen Print', 'DTG', 'Heat Transfer', 'Embroidery'],
    }
  }
};
