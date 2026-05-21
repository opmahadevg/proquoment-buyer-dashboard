'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import StatusBadge from '@/components/ui/StatusBadge';
import StageBadge from '@/components/ui/StageBadge';
import ChatButton from '@/components/ui/ChatButton';
import { productService, DbProduct } from '@/lib/services/dbService';
import { getStoredProducts } from '@/lib/productStore';
import { ALL_PRODUCT_DETAIL_DATA } from '@/lib/productDetailData';
import { Loader2, Sparkles } from 'lucide-react';

type Tab = 'sourcing' | 'drafts' | 'archived';

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

function mergeWithLocalStorage(base: DbProduct[]): DbProduct[] {
  const stored = getStoredProducts();
  if (!stored.length) return base;
  const baseIds = new Set(base.map((p) => p.id));
  const localAsDb: DbProduct[] = stored
    .filter((p) => !baseIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      moq: p.moq,
      image: p.image,
      imageAlt: p.imageAlt,
      stage: p.stage as DbProduct['stage'],
      status: p.status as DbProduct['status'],
      updated: p.updated,
      ownerId: '',
      organizationId: null,
      isStatic: false,
    }));
  return [...localAsDb, ...base];
}

export default function ProductsListContent() {
  const [activeTab, setActiveTab] = useState<Tab>('sourcing');
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      const base = data && data.length > 0 ? data : STATIC_PRODUCTS;
      setProducts(mergeWithLocalStorage(base));
    } catch {
      setProducts(mergeWithLocalStorage(STATIC_PRODUCTS));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    const refresh = () => {
      setProducts((prev) => mergeWithLocalStorage(prev));
    };
    window.addEventListener('proquoment_products_updated', refresh);
    return () => window.removeEventListener('proquoment_products_updated', refresh);
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
    <div className="px-4 md:px-8 py-5 md:py-8 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">Products</h1>
        <Link
          href="/new-product"
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] active:scale-95 transition-all duration-150"
        >
          <Sparkles size={14} />
          <span className="hidden sm:inline">New Product</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] mb-5">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 md:px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-primary' : 'text-[var(--muted-foreground)]'}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'sourcing' && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                {sourcingProducts.length} Sourcing
              </h2>

              {sourcingProducts.length === 0 && (
                <div className="bg-white rounded-xl border border-[var(--border)] px-5 py-12 text-center">
                  <p className="text-sm text-[var(--muted-foreground)] mb-3">
                    No sourcing products yet.
                  </p>
                  <Link
                    href="/new-product"
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Create your first RFQ →
                  </Link>
                </div>
              )}

              {/* Desktop table */}
              {sourcingProducts.length > 0 && (
                <>
                  <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="grid grid-cols-[1fr_180px_160px_140px] px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Name
                      </span>
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Status
                      </span>
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Stage
                      </span>
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Updated
                      </span>
                    </div>
                    {sourcingProducts.map((product, i) => (
                      <Link
                        key={product.id}
                        href={`/product-detail?id=${product.id}`}
                        className="grid grid-cols-[1fr_180px_160px_140px] px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 transition-all duration-150 items-center group"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)] flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-primary transition-colors duration-150 block">
                                {product.name}
                              </span>
                              {!product.isStatic && (
                                <span className="flex-shrink-0 text-[10px] font-semibold text-primary bg-[var(--secondary)] px-2 py-0.5 rounded-full">
                                  AI RFQ
                                </span>
                              )}
                            </div>
                            {(product.category || product.moq) && (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                {product.category}
                                {product.moq ? ` · MOQ: ${product.moq}` : ''}
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
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {product.updated}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {sourcingProducts.map((product, i) => (
                      <Link
                        key={product.id}
                        href={`/product-detail?id=${product.id}`}
                        className="flex items-center gap-3 bg-white rounded-xl border border-[var(--border)] p-4 active:bg-[var(--muted)]/40 transition-colors"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)] flex items-center justify-center">
                          {product.image ? (
                            <AppImage
                              src={product.image}
                              alt={product.imageAlt}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {product.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                              {product.name}
                            </span>
                            {!product.isStatic && (
                              <span className="flex-shrink-0 text-[10px] font-semibold text-primary bg-[var(--secondary)] px-1.5 py-0.5 rounded-full">
                                AI
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={product.status} />
                            <StageBadge stage={product.stage} />
                          </div>
                          <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            {product.updated}
                          </p>
                        </div>
                        <span className="text-[var(--muted-foreground)]">›</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'drafts' && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                {draftProducts.length} Drafts
              </h2>

              {draftProducts.length === 0 && (
                <div className="bg-white rounded-xl border border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No draft products yet.
                </div>
              )}

              {draftProducts.length > 0 && (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="grid grid-cols-[1fr_200px_160px] px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Name
                      </span>
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Stage
                      </span>
                      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Created
                      </span>
                    </div>
                    {draftProducts.map((product, i) => (
                      <Link
                        key={product.id}
                        href={`/product-detail?id=${product.id}`}
                        className="grid grid-cols-[1fr_200px_160px] px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 transition-all duration-150 items-center group"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)] transition-transform duration-150 group-hover:scale-105">
                            {product.image ? (
                              <AppImage
                                src={product.image}
                                alt={product.imageAlt}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-bold text-primary flex items-center justify-center h-full">
                                {product.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--foreground)] truncate group-hover:text-primary transition-colors duration-150">
                            {product.name}
                          </span>
                        </div>
                        <div>
                          <StageBadge stage={product.stage} />
                        </div>
                        <span className="text-sm text-[var(--muted-foreground)]">
                          {product.updated}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {draftProducts.map((product, i) => (
                      <Link
                        key={product.id}
                        href={`/product-detail?id=${product.id}`}
                        className="flex items-center gap-3 bg-white rounded-xl border border-[var(--border)] p-4 active:bg-[var(--muted)]/40 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--muted)] flex items-center justify-center">
                          {product.image ? (
                            <AppImage
                              src={product.image}
                              alt={product.imageAlt}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {product.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-[var(--foreground)] truncate block mb-1">
                            {product.name}
                          </span>
                          <StageBadge stage={product.stage} />
                          <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            {product.updated}
                          </p>
                        </div>
                        <span className="text-[var(--muted-foreground)]">›</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'archived' && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                {archivedProducts.length} Archived
              </h2>
              <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No archived products.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ChatButton />
    </div>
  );
}
