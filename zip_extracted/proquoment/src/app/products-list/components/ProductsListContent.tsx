'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import StatusBadge from '@/components/ui/StatusBadge';
import StageBadge from '@/components/ui/StageBadge';
import ChatButton from '@/components/ui/ChatButton';
import { productService, DbProduct } from '@/lib/services/dbService';
import { ALL_PRODUCT_DETAIL_DATA } from '@/lib/productDetailData';
import { Loader2 } from 'lucide-react';

type Tab = 'sourcing' | 'drafts' | 'archived';

// Map static product detail data to DbProduct shape for fallback display
const STATIC_PRODUCTS: DbProduct[] = Object.values(ALL_PRODUCT_DETAIL_DATA).map((p) => ({
  id: p.id,
  name: p.name,
  category: '',
  description: '',
  moq: '',
  image: p.image,
  imageAlt: p.imageAlt,
  stage: p.stage as DbProduct['stage'],
  status: 'No Updates' as DbProduct['status'],
  updated: 'May 2, 2026',
  ownerId: '',
  organizationId: null,
  isStatic: true,
}));

export default function ProductsListContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sourcing');
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await productService.getAll();
        if (data && data.length > 0) {
          setProducts(data);
        } else {
          // Fallback to static product data when not authenticated or DB empty
          setProducts(STATIC_PRODUCTS);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        // Fallback to static data on error
        setProducts(STATIC_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sourcingProducts = products.filter((p) => p.stage !== 'Draft');
  const draftProducts = products.filter((p) => p.stage === 'Draft');
  const archivedProducts: DbProduct[] = [];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'sourcing', label: 'Sourcing', count: sourcingProducts.length },
    { id: 'drafts', label: 'Drafts', count: draftProducts.length },
    { id: 'archived', label: 'Archived', count: archivedProducts.length },
  ];

  return (
    <div className="px-8 py-8 max-w-screen-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-5">Products</h1>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {/* Sourcing Tab */}
      {!loading && activeTab === 'sourcing' && (
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
            {sourcingProducts.length} Sourcing
          </h2>
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[1fr_180px_160px_140px] px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Name</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Status</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Stage</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Updated</span>
            </div>
            {sourcingProducts.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
                No sourcing products yet.
              </div>
            )}
            {sourcingProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product-detail?id=${product.id}`}
                className="grid grid-cols-[1fr_180px_160px_140px] px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors items-center group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)] flex items-center justify-center">
                    {product.image ? (
                      <AppImage
                        src={product.image}
                        alt={product.imageAlt}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-primary transition-colors block">
                      {product.name}
                    </span>
                    {product.category && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {product.category}{product.moq ? ` · MOQ: ${product.moq}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <StatusBadge status={product.status} />
                </div>
                <div>
                  <StageBadge stage={product.stage} />
                </div>
                <span className="text-sm text-[var(--muted-foreground)]">{product.updated}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Drafts Tab */}
      {!loading && activeTab === 'drafts' && (
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
            {draftProducts.length} Drafts
          </h2>
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="grid grid-cols-[1fr_200px_160px] px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Name</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Stage</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Created</span>
            </div>
            {draftProducts.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
                No draft products yet.
              </div>
            )}
            {draftProducts.map((product) => (
              <Link
                key={product.id}
                href={`/product-detail?id=${product.id}`}
                className="grid grid-cols-[1fr_200px_160px] px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors items-center group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)]">
                    {product.image ? (
                      <AppImage src={product.image} alt={product.imageAlt} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-primary flex items-center justify-center h-full">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-primary transition-colors">
                    {product.name}
                  </span>
                </div>
                <div>
                  <StageBadge stage={product.stage} />
                </div>
                <span className="text-sm text-[var(--muted-foreground)]">{product.updated}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Archived Tab */}
      {!loading && activeTab === 'archived' && (
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
            {archivedProducts.length} Archived
          </h2>
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No archived products.
            </div>
          </div>
        </div>
      )}

      <ChatButton />
    </div>
  );
}