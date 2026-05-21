import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ProductDetailContent from './components/ProductDetailContent';

export default function ProductDetailPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="px-8 py-6 text-sm text-[var(--muted-foreground)]">Loading product...</div>
        }
      >
        <ProductDetailContent />
      </Suspense>
    </AppLayout>
  );
}
