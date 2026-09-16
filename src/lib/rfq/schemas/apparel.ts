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
      label: 'Fabric Weight (GSM / oz)',
    },
    'specifications.fabric_construction': {
      requirement: 'recommended',
      label: 'Fabric Weave / Construction',
      options: ['3x1 Right Hand Twill', '2x1 Twill', 'Broken Twill', 'Plain Weave', 'Selvedge Denim', 'Single Jersey', 'Fleece', 'French Terry'],
    },
    'specifications.wash_finish': {
      requirement: 'recommended',
      label: 'Wash / Finish Treatment',
      options: ['Raw / Rigid', 'Enzyme Stone Wash', 'Vintage / Distressed', 'Acid Wash', 'Ozone Eco Wash', 'Garment Dyed', 'Silicon Softener Wash'],
    },
    'specifications.hardware_trims': {
      requirement: 'optional',
      label: 'Hardware & Trims',
      description: 'e.g. YKK zipper, antique copper rivets, shank buttons, leather patch',
    },
    'specifications.size_range': {
      requirement: 'required',
      label: 'Size Range & Breakdown',
      description: 'e.g. 30x32: 525, 32x32: 1050, or S-XXL with ratio',
      render_type: 'size_grid',
      ai_prompt_hint: 'Parse waist×inseam pairs or standard sizing ratios into structured size_run matrix.'
    },
    'manufacturing.printing_method': {
      requirement: 'optional',
      label: 'Printing/Embroidery Method',
      options: ['Screen Print', 'DTG', 'Heat Transfer', 'Embroidery', 'None'],
    }
  }
};
