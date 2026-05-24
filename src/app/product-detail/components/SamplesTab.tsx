'use client';

import React, { useState, useEffect } from 'react';
import AppImage from '@/components/ui/AppImage';
import { 
  Clock, Info, CreditCard, Calendar, Check, Loader2, AlertCircle, 
  CheckCircle2, FileText, Download, CheckSquare, Square, ChevronRight,
  Shield, Package, Truck, Cpu, FileCheck
} from 'lucide-react';
import { placeSampleOrders, fetchSampleStages, fetchSampleDocuments } from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';

export interface SampleItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  supplier: string;
  stage: string;
  requested: string;
  completion: string;
}

export interface ReferenceItem {
  id: string;
  image: string;
  imageAlt: string;
  name: string;
  type: string;
  creator: string;
  stage: string;
  requested: string;
}

interface SamplesTabProps {
  samples: SampleItem[];
  references: ReferenceItem[];
  receivedQuotes?: any[];
  rfqId?: string;
  onRefresh?: () => void;
}

const STAGE_STEPS = [
  { key: 'process', label: 'Process Design', icon: Cpu },
  { key: 'qa', label: 'Quality Check', icon: Shield },
  { key: 'manufacturing', label: 'Manufacturing', icon: FileCheck },
  { key: 'packing', label: 'Packing', icon: Package },
  { key: 'shipping', label: 'Shipping & Delivery', icon: Truck },
];

export default function SamplesTab({
  samples,
  references,
  receivedQuotes = [],
  rfqId,
  onRefresh,
}: SamplesTabProps) {
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected Order for tracking stages/documents
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderStages, setOrderStages] = useState<any[]>([]);
  const [orderDocs, setOrderDocs] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Toggle selection for a quote
  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuoteIds(prev => 
      prev.includes(quoteId) 
        ? prev.filter(id => id !== quoteId) 
        : [...prev, quoteId]
    );
  };

  // Place sample orders in batch
  const handlePlaceSampleOrders = async () => {
    if (!rfqId) {
      setErrorMsg('No RFQ linked to this product. Cannot process sample order.');
      return;
    }
    if (selectedQuoteIds.length === 0) {
      setErrorMsg('Please select at least one quote.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await placeSampleOrders(selectedQuoteIds, rfqId);
      setSuccessMsg(`Successfully ordered sample(s) from ${selectedQuoteIds.length} supplier(s)!`);
      setSelectedQuoteIds([]);
      setTimeout(() => setSuccessMsg(null), 5000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Error ordering samples:', err);
      setErrorMsg(err.message || 'Failed to place sample orders. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Live subscription to selected order's stage & document changes
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderStages([]);
      setOrderDocs([]);
      return;
    }

    const loadStagesAndDocs = async () => {
      setLoadingDetails(true);
      try {
        const [stagesData, docsData] = await Promise.all([
          fetchSampleStages(selectedOrderId),
          fetchSampleDocuments(selectedOrderId)
        ]);
        setOrderStages(stagesData);
        setOrderDocs(docsData);
      } catch (err) {
        console.error('Error loading order stages/docs:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadStagesAndDocs();

    const client = createClient();
    if (!client) return;

    const channel = client.channel(`buyer-sample-order-details-${selectedOrderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sample_stages', filter: `sample_order_id=eq.${selectedOrderId}` }, () => {
        loadStagesAndDocs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sample_documents', filter: `sample_order_id=eq.${selectedOrderId}` }, () => {
        loadStagesAndDocs();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [selectedOrderId]);

  return (
    <div className="space-y-8">
      {/* Messages */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-fade-in">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Received Sample Quotes */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
            Supplier Sample Quotes
          </h2>

          {selectedQuoteIds.length > 0 && (
            <button
              onClick={handlePlaceSampleOrders}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/10"
            >
              {submitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Placing orders...
                </>
              ) : (
                `Place Sample Order (${selectedQuoteIds.length})`
              )}
            </button>
          )}
        </div>

        {receivedQuotes.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-[var(--border)] bg-white/[0.01] text-center">
            <Info size={20} className="mx-auto text-indigo-400 mb-2" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Awaiting Supplier Quotes</h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-md mx-auto">
              Once you submit an RFQ, assigned suppliers will upload customized sample quotes. They will be displayed here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {receivedQuotes.map((quote) => {
              const isAccepted = quote.status === 'order_placed' || quote.status === 'buyer_accepted';
              const isSelected = selectedQuoteIds.includes(quote.id);

              return (
                <div
                  key={quote.id}
                  onClick={() => !isAccepted && toggleQuoteSelection(quote.id)}
                  className={`relative p-5 rounded-xl border transition-all duration-300 cursor-pointer ${
                    isAccepted
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-emerald-500/5 cursor-default'
                      : isSelected
                      ? 'border-indigo-500/55 bg-indigo-500/[0.04] shadow-indigo-500/10 scale-[1.01]'
                      : 'border-[var(--border)] bg-black/[0.15] hover:border-white/20 hover:bg-black/[0.2] shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-2.5">
                      {!isAccepted && (
                        <div className="text-indigo-400 mt-0.5 flex-shrink-0">
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          {quote.supplierId ? `Supplier #${quote.supplierId}` : 'Verified Supplier'}
                        </h3>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Quote ID: {quote.id}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[var(--foreground)]">
                        ${quote.unitPrice ? Number(quote.unitPrice).toFixed(2) : '0.00'}
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">per sample</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs mb-4 text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-indigo-400" />
                      <span>Lead Time: <strong className="text-[var(--foreground)]">{quote.leadTimeDays || 7} days</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-indigo-400" />
                      <span>Qty: <strong className="text-[var(--foreground)]">{quote.moq || 1} units</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-indigo-400" />
                      <span>Terms: <strong className="text-[var(--foreground)]">{quote.paymentTerms || 'Net 30'}</strong></span>
                    </div>
                    {quote.validUntil && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-400" />
                        <span>Valid: <strong className="text-[var(--foreground)]">{new Date(quote.validUntil).toLocaleDateString()}</strong></span>
                      </div>
                    )}
                  </div>

                  {quote.notes && (
                    <p className="text-xs text-[var(--muted-foreground)] bg-white/[0.02] p-2.5 rounded-lg border border-white/5 mb-4 italic">
                      "{quote.notes}"
                    </p>
                  )}

                  {isAccepted && (
                    <div className="flex items-center justify-end">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check size={12} /> Accepted & Ordered
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Samples Orders Table Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {samples.length} Active Sample Orders
        </h2>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)] w-[80px]">Image</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Name</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Supplier</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Stage</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Requested</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Last Action</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)] text-right">Progress</th>
              </tr>
            </thead>
            <tbody>
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)] text-sm">
                    No active sample orders
                  </td>
                </tr>
              ) : (
                samples.map((sample) => {
                  const isSelected = selectedOrderId === sample.id;
                  return (
                    <tr 
                      key={sample.id} 
                      onClick={() => setSelectedOrderId(isSelected ? null : sample.id)}
                      className={`border-b border-[var(--border)] hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        isSelected ? 'bg-white/[0.03]' : ''
                      }`}
                    >
                      <td className="py-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
                          <AppImage
                            src={sample.image}
                            alt={sample.imageAlt}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="py-4 text-sm font-semibold text-[var(--foreground)] pr-4 max-w-[200px] truncate">
                        <div>{sample.name}</div>
                        <span className="text-[10px] text-[var(--muted-foreground)] font-normal block mt-0.5">{sample.id}</span>
                      </td>
                      <td className="py-4 text-sm text-[var(--muted-foreground)] font-medium">{sample.supplier}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                          sample.stage.toLowerCase() === 'completed' || sample.stage.toLowerCase() === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {sample.stage.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.requested}</td>
                      <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.completion}</td>
                      <td className="py-4 text-right">
                        <span className="text-xs text-indigo-400 font-bold hover:underline flex items-center justify-end gap-1">
                          Track <ChevronRight size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tracker Drawer / Details view (renders when an order is selected) */}
      {selectedOrderId && (
        <div className="bg-black/[0.25] border border-[var(--border)] rounded-2xl p-6 shadow-lg animate-fade-in space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <span className="text-[10px] tracking-wider font-bold text-indigo-400 uppercase">
                SPECIMEN COMPLIANCE DOSSIER
              </span>
              <h3 className="text-base font-bold text-[var(--foreground)] mt-0.5">
                Real-Time Tracker for Order {selectedOrderId}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedOrderId(null)} 
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-medium"
            >
              Close Tracker
            </button>
          </div>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-12 text-indigo-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-semibold">Syncing timeline...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Stepper Timeline Tracker */}
              <div className="lg:col-span-2 space-y-5">
                <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">Manufacturing & Delivery Timeline</h4>
                <div className="space-y-4 relative pl-4 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
                  {STAGE_STEPS.map((step) => {
                    const dbStage = orderStages.find(s => s.stage_name === step.key);
                    const StepIcon = step.icon;

                    let statusBg = 'bg-zinc-800 text-zinc-500 border-zinc-700';
                    let statusLabel = 'Pending';
                    if (dbStage?.status === 'completed') {
                      statusBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      statusLabel = 'Completed';
                    } else if (dbStage?.status === 'in_progress') {
                      statusBg = 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse';
                      statusLabel = 'In Progress';
                    } else if (dbStage?.status === 'flagged') {
                      statusBg = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                      statusLabel = 'Issue / Flagged';
                    }

                    return (
                      <div key={step.key} className="flex gap-4 items-start relative">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${statusBg}`}>
                          <StepIcon size={16} />
                        </div>
                        <div className="flex-1 bg-white/[0.01] border border-[var(--border)] rounded-xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <h5 className="text-xs font-bold text-[var(--foreground)]">{step.label}</h5>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBg}`}>
                              {statusLabel}
                            </span>
                          </div>
                          {dbStage?.notes ? (
                            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mt-1">{dbStage.notes}</p>
                          ) : (
                            <p className="text-xs text-[var(--muted-foreground)]/50 leading-relaxed italic mt-1">No updates provided yet</p>
                          )}
                          {dbStage?.updated_at && (
                            <span className="text-[9px] text-[var(--muted-foreground)] block mt-2 text-right">
                              Last updated: {new Date(dbStage.updated_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Compliance Document dossier */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">compliance documentation</h4>
                
                {orderDocs.length === 0 ? (
                  <div className="border border-[var(--border)] rounded-xl p-5 text-center bg-white/[0.01]">
                    <FileText size={18} className="mx-auto text-indigo-400 mb-1.5" />
                    <p className="text-xs font-semibold text-[var(--foreground)]">No compliance files</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Supplier has not uploaded any verification certificates yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {orderDocs.map((doc) => (
                      <div 
                        key={doc.id}
                        className="bg-black/10 border border-[var(--border)] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-white/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-[var(--foreground)] truncate" title={doc.doc_type}>
                            {doc.doc_type}
                          </h5>
                          <span className="text-[9px] text-[var(--muted-foreground)] block mt-0.5 uppercase tracking-wide">
                            Stage: {doc.stage_name}
                          </span>
                          <span className="text-[9px] text-[var(--muted-foreground)] truncate max-w-[150px] block mt-0.5 italic">
                            {doc.file_name || 'compliance_file.pdf'}
                          </span>
                        </div>
                        <a 
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all flex items-center justify-center flex-shrink-0"
                          title="Download document"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* References Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {references.length} Reference Materials
        </h2>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)] w-[80px]">Image</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Name</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Type</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Creator</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Stage</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Requested</th>
              </tr>
            </thead>
            <tbody>
              {references.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--muted-foreground)] text-sm">
                    No reference materials
                  </td>
                </tr>
              ) : (
                references.map((ref) => (
                  <tr key={ref.id} className="border-b border-[var(--border)] hover:bg-white/[0.01] transition-colors">
                    <td className="py-4">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
                        <AppImage
                          src={ref.image}
                          alt={ref.imageAlt}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="py-4 text-sm font-medium text-[var(--foreground)] pr-4 max-w-[200px] truncate">
                      {ref.name}
                    </td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{ref.type}</td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{ref.creator}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-zinc-500/10 text-zinc-400 border border-zinc-500/20`}>
                        {ref.stage}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{ref.requested}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
