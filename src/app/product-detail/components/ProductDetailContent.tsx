'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import StageBadge from '@/components/ui/StageBadge';
import UpdatesTab from './UpdatesTab';
import QuotesTab from './QuotesTab';
import OrdersTab from './OrdersTab';
import FilesTab from './FilesTab';
import SamplesTab from './SamplesTab';
import ChatButton from '@/components/ui/ChatButton';
import {
  ChevronLeft,
  FileText,
  X,
  Pencil,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getProductDetailData, ALL_PRODUCT_DETAIL_DATA } from '@/lib/productDetailData';
import { getStoredProducts, saveProduct, StoredProduct } from '@/lib/productStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  productService,
  rfqService,
  quoteService,
  orderService,
  sampleService,
  fileService,
  updateService,
  DbProduct,
  DbRfqSpec,
  DbQuoteStep,
  DbOrder,
  DbSample,
  DbProductFile,
  DbProductUpdate,
} from '@/lib/services/dbService';

type Tab = 'updates' | 'quotes' | 'samples' | 'orders' | 'files';

const FALLBACK_PRODUCT = ALL_PRODUCT_DETAIL_DATA['prod-001'];

export default function ProductDetailContent() {
  const [activeTab, setActiveTab] = useState<Tab>('updates');
  const [specsOpen, setSpecsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [storedProduct, setStoredProduct] = useState<StoredProduct | null>(null);
  const [editForm, setEditForm] = useState<StoredProduct | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    specifications: true,
    manufacturingNotes: true,
  });
  const { user } = useAuth();

  // Supabase data
  const [dbProduct, setDbProduct] = useState<DbProduct | null>(null);
  const [dbRfq, setDbRfq] = useState<DbRfqSpec | null>(null);
  const [dbQuoteSteps, setDbQuoteSteps] = useState<DbQuoteStep[]>([]);
  const [dbOrders, setDbOrders] = useState<DbOrder[]>([]);
  const [dbSamples, setDbSamples] = useState<{ samples: DbSample[]; references: DbSample[] }>({
    samples: [],
    references: [],
  });
  const [dbFiles, setDbFiles] = useState<DbProductFile[]>([]);
  const [dbUpdates, setDbUpdates] = useState<{
    tasks: DbProductUpdate[];
    updates: DbProductUpdate[];
  }>({ tasks: [], updates: [] });
  const [dbLoading, setDbLoading] = useState(true);

  const searchParams = useSearchParams();
  const productId = searchParams?.get('id') ?? 'prod-001';
  const staticProduct = getProductDetailData(productId);

  // Load from localStorage (legacy)
  useEffect(() => {
    const load = () => {
      const stored = getStoredProducts(user?.id);
      const found = stored.find((p) => p.id === productId) ?? null;
      setStoredProduct(found);
    };
    load();
    window.addEventListener('proquoment_products_updated', load);
    return () => window.removeEventListener('proquoment_products_updated', load);
  }, [productId, user?.id]);

  // Load from Supabase
  useEffect(() => {
    const loadFromDb = async () => {
      setDbLoading(true);
      try {
        const [prod, rfq, quotes, orders, samples, files, updates] = await Promise.all([
          productService.getById(productId),
          rfqService.getByProductId(productId),
          quoteService.getByProductId(productId),
          orderService.getByProductId(productId),
          sampleService.getByProductId(productId),
          fileService.getByProductId(productId),
          updateService.getByProductId(productId),
        ]);
        setDbProduct(prod);
        setDbRfq(rfq);
        setDbQuoteSteps(quotes);
        setDbOrders(orders);
        setDbSamples(samples);
        setDbFiles(files);
        setDbUpdates(updates);
      } catch (err) {
        console.error('Failed to load product detail from Supabase:', err);
      } finally {
        setDbLoading(false);
      }
    };
    loadFromDb();
  }, [productId]);

  // Subscribe to real-time database changes for this product
  useEffect(() => {
    const client = createClient();
    if (!client) return;

    const productChannel = client
      .channel(`product-realtime-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `id=eq.${productId}` },
        async () => {
          const prod = await productService.getById(productId);
          setDbProduct(prod);
        }
      )
      .subscribe();

    const globalChannel = client
      .channel(`product-details-global-${productId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfqs' }, async () => {
        const rfq = await rfqService.getByProductId(productId);
        setDbRfq(rfq);
        const quotes = await quoteService.getByProductId(productId);
        setDbQuoteSteps(quotes);
        const updates = await updateService.getByProductId(productId);
        setDbUpdates(updates);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, async () => {
        const quotes = await quoteService.getByProductId(productId);
        setDbQuoteSteps(quotes);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        const orders = await orderService.getByProductId(productId);
        setDbOrders(orders);
        const files = await fileService.getByProductId(productId);
        setDbFiles(files);
        const updates = await updateService.getByProductId(productId);
        setDbUpdates(updates);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sample_orders' },
        async () => {
          const samples = await sampleService.getByProductId(productId);
          setDbSamples(samples);
          const files = await fileService.getByProductId(productId);
          setDbFiles(files);
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, async () => {
        const files = await fileService.getByProductId(productId);
        setDbFiles(files);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, async () => {
        const updates = await updateService.getByProductId(productId);
        setDbUpdates(updates);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        async () => {
          const updates = await updateService.getByProductId(productId);
          setDbUpdates(updates);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(productChannel);
      client.removeChannel(globalChannel);
    };
  }, [productId]);

  // Build product display shape: prefer DB data, fallback to static, then localStorage
  const product = useMemo(() => {
    if (dbProduct) {
      return {
        id: dbProduct.id,
        name: dbProduct.name,
        image: dbProduct.image,
        imageAlt: dbProduct.imageAlt,
        stage: dbProduct.stage,
        updates: {
          tasks: dbUpdates.tasks.map((t) => ({
            id: t.id,
            type: t.updateType,
            title: t.title,
            description: t.description,
            date: t.updateDate,
            supplier: t.supplier,
            replies: t.replies,
          })),
          updates: dbUpdates.updates.map((u) => ({
            id: u.id,
            title: u.title,
            description: u.description,
            date: u.updateDate,
            supplier: u.supplier,
            replies: u.replies,
          })),
        },
        quotes: {
          steps: dbQuoteSteps.map((s) => ({
            id: s.stepOrder,
            label: s.label,
            highlight: s.highlight,
            highlightSuffix: s.highlightSuffix,
            description: s.description,
            status: s.stepStatus,
            inProgress: s.inProgress,
          })),
          supplierCount: dbQuoteSteps[0]?.supplierCount ?? 0,
          totalSuppliers: dbQuoteSteps[0]?.totalSuppliers ?? 0,
        },
        orders: {
          orders: dbOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            description: o.description,
            status: o.orderStatus,
            statusColor: o.statusColor,
            supplier: o.supplier,
            placedDate: o.placedDate,
            estimatedDelivery: o.estimatedDelivery,
            amount: o.amount,
          })),
          steps: dbOrders[0]?.steps ?? [],
        },
        files: dbFiles.map((f) => ({ id: f.id, name: f.name, date: f.fileDate })),
        samples: {
          samples: dbSamples.samples.map((s) => ({
            id: s.id,
            image: s.image,
            imageAlt: s.imageAlt,
            name: s.name,
            type: s.sampleType,
            supplier: s.supplier,
            stage: s.stage,
            requested: s.requested,
            completion: s.completion,
          })),
          references: dbSamples.references.map((r) => ({
            id: r.id,
            image: r.image,
            imageAlt: r.imageAlt,
            name: r.name,
            type: r.sampleType,
            creator: r.creator,
            stage: r.stage,
            requested: r.requested,
          })),
        },
      };
    }
    if (staticProduct) return staticProduct;
    if (storedProduct) {
      return {
        id: storedProduct.id,
        name: storedProduct.name,
        image: storedProduct.image,
        imageAlt: storedProduct.imageAlt,
        stage: storedProduct.stage,
        updates: {
          tasks: [],
          updates: [
            {
              id: 'rfq-submitted',
              title: 'RFQ submitted via AI sourcing agent',
              description: storedProduct.description
                ? `Product: ${storedProduct.name}. ${storedProduct.description}${storedProduct.moq ? ` MOQ: ${storedProduct.moq}.` : ''}`
                : `Your RFQ for "${storedProduct.name}" has been submitted. Proquoment is now matching you with verified manufacturers.`,
              date: storedProduct.updated,
              supplier: 'Proquoment AI',
              replies: 0,
            },
          ],
        },
        quotes: {
          steps: [
            {
              id: 1,
              label: 'Matching suppliers',
              highlight: 'verified manufacturers',
              highlightSuffix: ' in our network',
              description: 'We are scanning our supplier network for the best matches.',
              status: 'active' as const,
              inProgress: true,
            },
            {
              id: 2,
              label: 'Sending RFQ to shortlist',
              highlight: null,
              highlightSuffix: '',
              description: 'Your RFQ will be sent to matched suppliers for pricing.',
              status: 'pending' as const,
              inProgress: false,
            },
            {
              id: 3,
              label: 'Receiving quotes',
              highlight: null,
              highlightSuffix: '',
              description: 'Supplier quotes will appear here once received.',
              status: 'pending' as const,
              inProgress: false,
            },
            {
              id: 4,
              label: 'Review & select',
              highlight: null,
              highlightSuffix: '',
              description: 'Compare quotes and select your preferred supplier.',
              status: 'pending' as const,
              inProgress: false,
            },
          ],
          supplierCount: 0,
          totalSuppliers: 165,
        },
        orders: { orders: [], steps: [] },
        files: [],
        samples: { samples: [], references: [] },
      };
    }
    return FALLBACK_PRODUCT;
  }, [
    staticProduct,
    dbProduct,
    dbUpdates,
    dbQuoteSteps,
    dbOrders,
    dbFiles,
    dbSamples,
    storedProduct,
  ]);

  // Determine effective RFQ data (DB takes priority over localStorage)
  const effectiveRfq = useMemo(() => {
    if (dbRfq) {
      return {
        name: dbProduct?.name ?? storedProduct?.name ?? '',
        category: dbProduct?.category ?? storedProduct?.category ?? '',
        description: dbProduct?.description ?? storedProduct?.description ?? '',
        moq: dbProduct?.moq ?? storedProduct?.moq ?? '',
        specifications: dbRfq.specifications,
        manufacturingNotes: dbRfq.manufacturingNotes,
      };
    }
    if (storedProduct) {
      return {
        name: storedProduct.name,
        category: storedProduct.category,
        description: storedProduct.description,
        moq: storedProduct.moq,
        specifications: storedProduct.specifications,
        manufacturingNotes: storedProduct.manufacturingNotes,
      };
    }
    return null;
  }, [dbRfq, dbProduct, storedProduct]);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    {
      id: 'updates',
      label: 'Updates',
      badge: (product?.updates?.tasks?.length ?? 0) + (product?.updates?.updates?.length ?? 0),
    },
    {
      id: 'quotes',
      label: 'Quotes',
      badge: product?.quotes?.steps?.filter((s) => s?.status === 'completed')?.length,
    },
    {
      id: 'samples',
      label: 'Samples',
      badge: (product?.samples?.samples?.length ?? 0) || undefined,
    },
    { id: 'orders', label: 'Orders', badge: product?.orders?.orders?.length || undefined },
    { id: 'files', label: 'Files', badge: product?.files?.length || undefined },
  ];

  const openEdit = () => {
    if (storedProduct) {
      setEditForm(JSON.parse(JSON.stringify(storedProduct)));
      setEditOpen(true);
    }
  };

  const handleSave = () => {
    if (!editForm) return;
    saveProduct(editForm);
    setStoredProduct(editForm);
    setEditOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const updateSpecValue = (index: number, value: string) => {
    if (!editForm) return;
    const updated = {
      ...editForm,
      specifications: editForm.specifications.map((s, i) =>
        i === index ? { ...s, value, pending: !value || value === '(Pending)' } : s
      ),
    };
    setEditForm(updated);
  };

  const updateNoteValue = (index: number, value: string) => {
    if (!editForm) return;
    const updated = {
      ...editForm,
      manufacturingNotes: editForm.manufacturingNotes.map((n, i) =>
        i === index ? { ...n, value, pending: !value || value === '(Pending)' } : n
      ),
    };
    setEditForm(updated);
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filledCount = effectiveRfq
    ? effectiveRfq.specifications.filter((s) => !s.pending && s.value && s.value !== '(Pending)')
        .length +
      effectiveRfq.manufacturingNotes.filter(
        (n) => !n.pending && n.value && n.value !== '(Pending)'
      ).length
    : 0;
  const totalCount = effectiveRfq
    ? effectiveRfq.specifications.length + effectiveRfq.manufacturingNotes.length
    : 0;
  const completionPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  return (
    <div className="px-8 py-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/products-list"
            className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
            <AppImage
              src={product?.image}
              alt={product?.imageAlt}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">{product?.name}</h1>
          <StageBadge stage={product?.stage} />
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-pulse">
              <CheckCircle size={15} /> RFQ updated
            </span>
          )}
          <button
            onClick={() => setSpecsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <FileText size={15} />
            Product specs
            {effectiveRfq && (
              <span className="ml-1 text-xs font-semibold text-primary">{completionPct}%</span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={`pdtab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — keyed to trigger fade-in on tab switch */}
      {dbLoading && !staticProduct && !storedProduct ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div key={activeTab} className="animate-fade-in">
          {activeTab === 'updates' && (
            <UpdatesTab
              tasks={product?.updates?.tasks ?? []}
              updates={product?.updates?.updates ?? []}
            />
          )}
          {activeTab === 'quotes' && <QuotesTab steps={product?.quotes?.steps ?? []} />}
          {activeTab === 'samples' && (
            <SamplesTab
              samples={product?.samples?.samples ?? []}
              references={product?.samples?.references ?? []}
            />
          )}
          {activeTab === 'orders' && (
            <OrdersTab
              orders={product?.orders?.orders ?? []}
              steps={product?.orders?.steps ?? []}
            />
          )}
          {activeTab === 'files' && <FilesTab files={product?.files ?? []} />}
        </div>
      )}

      <ChatButton />

      {/* ── Product Specs Slide-over Panel ── */}
      {specsOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setSpecsOpen(false)}
          />
          <div className="w-full max-w-lg bg-[var(--background)] shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Product RFQ Specs</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate max-w-[280px]">
                  {effectiveRfq?.name ?? product?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {storedProduct && (
                  <button
                    onClick={openEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Pencil size={13} />
                    Update RFQ
                  </button>
                )}
                <button
                  onClick={() => setSpecsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {effectiveRfq ? (
                <>
                  {/* Completion bar */}
                  <div className="bg-[var(--muted)]/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        RFQ Completion
                      </span>
                      <span className="text-xs font-bold text-primary">{completionPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                      {filledCount} of {totalCount} fields filled
                    </p>
                  </div>

                  {/* Overview section */}
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('overview')}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 transition-colors"
                    >
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        Overview
                      </span>
                      {expandedSections.overview ? (
                        <ChevronUp size={15} className="text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown size={15} className="text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    {expandedSections.overview && (
                      <div className="divide-y divide-[var(--border)]">
                        <RfqRow label="Product Name" value={effectiveRfq.name} />
                        <RfqRow label="Category" value={effectiveRfq.category} />
                        <RfqRow label="Description" value={effectiveRfq.description} />
                        <RfqRow label="MOQ" value={effectiveRfq.moq} />
                      </div>
                    )}
                  </div>

                  {/* Specifications section */}
                  {effectiveRfq.specifications.length > 0 && (
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('specifications')}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          Specifications
                        </span>
                        {expandedSections.specifications ? (
                          <ChevronUp size={15} className="text-[var(--muted-foreground)]" />
                        ) : (
                          <ChevronDown size={15} className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                      {expandedSections.specifications && (
                        <div className="divide-y divide-[var(--border)]">
                          {effectiveRfq.specifications.map((spec, i) => (
                            <RfqRow
                              key={i}
                              label={spec.label}
                              value={spec.value}
                              pending={spec.pending}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manufacturing Notes section */}
                  {effectiveRfq.manufacturingNotes.length > 0 && (
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleSection('manufacturingNotes')}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          Manufacturing Notes
                        </span>
                        {expandedSections.manufacturingNotes ? (
                          <ChevronUp size={15} className="text-[var(--muted-foreground)]" />
                        ) : (
                          <ChevronDown size={15} className="text-[var(--muted-foreground)]" />
                        )}
                      </button>
                      {expandedSections.manufacturingNotes && (
                        <div className="divide-y divide-[var(--border)]">
                          {effectiveRfq.manufacturingNotes.map((note, i) => (
                            <RfqRow
                              key={i}
                              label={note.label}
                              value={note.value}
                              pending={note.pending}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
                    <FileText size={24} className="text-[var(--muted-foreground)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)] mb-1">
                    No RFQ data available
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] max-w-[240px]">
                    RFQ specifications are available for products created through the AI sourcing
                    flow.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Update RFQ Modal ── */}
      {editOpen && editForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
          />
          <div className="relative bg-[var(--background)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Update RFQ</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Edit your product requirements and specifications
                </p>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                  Overview
                </h3>
                <div className="space-y-3">
                  <EditField
                    label="Product Name"
                    value={editForm.name}
                    onChange={(v) => setEditForm({ ...editForm, name: v })}
                  />
                  <EditField
                    label="Category"
                    value={editForm.category}
                    onChange={(v) => setEditForm({ ...editForm, category: v })}
                  />
                  <EditField
                    label="Description"
                    value={editForm.description}
                    onChange={(v) => setEditForm({ ...editForm, description: v })}
                    multiline
                  />
                  <EditField
                    label="MOQ"
                    value={editForm.moq}
                    onChange={(v) => setEditForm({ ...editForm, moq: v })}
                    placeholder="e.g. 500 units"
                  />
                </div>
              </div>

              {editForm.specifications.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                    Specifications
                  </h3>
                  <div className="space-y-3">
                    {editForm.specifications.map((spec, i) => (
                      <EditField
                        key={i}
                        label={spec.label}
                        value={spec.value === '(Pending)' ? '' : spec.value}
                        onChange={(v) => updateSpecValue(i, v)}
                        placeholder="(Pending)"
                      />
                    ))}
                  </div>
                </div>
              )}

              {editForm.manufacturingNotes.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                    Manufacturing Notes
                  </h3>
                  <div className="space-y-3">
                    {editForm.manufacturingNotes.map((note, i) => (
                      <EditField
                        key={i}
                        label={note.label}
                        value={note.value === '(Pending)' ? '' : note.value}
                        onChange={(v) => updateNoteValue(i, v)}
                        placeholder="(Pending)"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]/20">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RfqRowProps {
  label: string;
  value: string;
  pending?: boolean;
}
function RfqRow({ label, value, pending }: RfqRowProps) {
  const isEmpty = !value || value === '(Pending)' || pending;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 mt-0.5">
        {isEmpty ? (
          <Clock size={13} className="text-[var(--muted-foreground)]" />
        ) : (
          <CheckCircle size={13} className="text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--muted-foreground)] mb-0.5">{label}</p>
        <p
          className={`text-sm ${isEmpty ? 'text-[var(--muted-foreground)] italic' : 'text-[var(--foreground)] font-medium'}`}
        >
          {isEmpty ? 'Pending' : value}
        </p>
      </div>
    </div>
  );
}

interface EditFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}
function EditField({
  label,
  value,
  onChange,
  placeholder = '',
  multiline = false,
}: EditFieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || label}
          rows={3}
          className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || label}
          className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      )}
    </div>
  );
}
