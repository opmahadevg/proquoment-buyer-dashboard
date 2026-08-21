import { CategorySchema } from './types';

export const footwearSchema: CategorySchema = {
  id: 'footwear',
  name: 'Footwear',
  fields: {
    'product.name': {
      requirement: 'required',
      label: 'Product Name',
    },
    'quantity.value': {
      requirement: 'required',
      label: 'Total Quantity',
    },
    'specifications.upper_material': {
      requirement: 'required',
      label: 'Upper Material',
      options: ['Leather', 'Synthetic', 'Mesh', 'Canvas', 'Suede'],
      ai_prompt_hint: 'If they say "sneaker", ask if they want breathable mesh or durable synthetic leather.'
    },
    'specifications.outsole_material': {
      requirement: 'required',
      label: 'Outsole Material',
      options: ['Rubber', 'EVA', 'TPR', 'PU'],
    },
    'specifications.size_range': {
      requirement: 'required',
      label: 'Size Range',
      description: 'e.g. US 7-12, EU 39-45'
    },
    'manufacturing.last_type': {
      requirement: 'recommended',
      label: 'Shoe Last Type',
      ai_prompt_hint: 'Only ask this if they seem technical, otherwise suggest the manufacturer can propose the best last.'
    }
  }
};
