import { CategorySchema } from './types';
import { footwearSchema } from './footwear';
import { apparelSchema } from './apparel';

import { genericProcurementSchema } from './generic-procurement';

const schemas: Record<string, CategorySchema> = {
  footwear: footwearSchema,
  apparel: apparelSchema,
  // Fallback generic schema
  generic: genericProcurementSchema
};

export function getSchemaForCategory(categoryId: string): CategorySchema {
  const specific = schemas[categoryId];
  if (!specific || categoryId === 'generic') {
    return genericProcurementSchema;
  }
  return {
    ...specific,
    fields: {
      ...genericProcurementSchema.fields,
      ...specific.fields
    }
  };
}

export * from './types';
