'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { Clock, Info, CreditCard, Calendar, Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { acceptSampleQuote } from '@/lib/services/procurementApi';

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

const stageBadgeColor = (stage: string) => {
  switch (stage.toLowerCase()) {
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'pending':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'in review':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'rejected':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'shipped':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
  }
};

export default function SamplesTab({
  samples,
  references,
  receivedQuotes = [],
  rfqId,
  onRefresh,
}: SamplesTabProps) {
  const [submittingQuoteId, setSubmittingQuoteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAcceptQuote = async (quoteId: string) => {
    if (!rfqId) {
      setErrorMsg('No RFQ linked to this product. Cannot process sample order.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmittingQuoteId(quoteId);

    try {
      await acceptSampleQuote(quoteId, rfqId);
      setSuccessMsg('Sample ordered successfully! The supplier has been notified.');
      setTimeout(() => setSuccessMsg(null), 5000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Error ordering sample:', err);
      setErrorMsg(err.message || 'Failed to order sample. Please try again.');
    } finally {
      setSubmittingQuoteId(null);
    }
  };

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
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
          Supplier Sample Quotes
        </h2>

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
              const isAccepted = quote.status === 'accepted';
              const isLoading = submittingQuoteId === quote.id;

              return (
                <div
                  key={quote.id}
                  className={`relative p-5 rounded-xl border transition-all duration-300 ${
                    isAccepted
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-emerald-500/5'
                      : 'border-[var(--border)] bg-black/[0.15] hover:border-white/20 hover:bg-black/[0.2] shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {quote.supplierName || 'Verified Supplier'}
                      </h3>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Quote ID: {quote.id}
                      </span>
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
                      <span>MOQ: <strong className="text-[var(--foreground)]">{quote.moq || 1} units</strong></span>
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

                  <div className="flex items-center justify-end">
                    {isAccepted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check size={12} /> Accepted & Ordered
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcceptQuote(quote.id)}
                        disabled={!!submittingQuoteId}
                        className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/10"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Ordering Sample...
                          </>
                        ) : (
                          'Accept & Order Sample'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Samples Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {samples.length} Active Sample Orders
        </h2>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)] w-[80px]">Image</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Name</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Type</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Supplier</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Stage</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Requested</th>
                <th className="pb-3 text-sm font-semibold text-[var(--muted-foreground)]">Completion</th>
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
                samples.map((sample) => (
                  <tr key={sample.id} className="border-b border-[var(--border)] hover:bg-white/[0.01] transition-colors">
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
                    <td className="py-4 text-sm font-medium text-[var(--foreground)] pr-4 max-w-[200px] truncate">
                      {sample.name}
                    </td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.type}</td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.supplier}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${stageBadgeColor(sample.stage)}`}>
                        {sample.stage}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.requested}</td>
                    <td className="py-4 text-sm text-[var(--muted-foreground)]">{sample.completion}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* References Section */}
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
          {references.length} Reference Materials
        </h2>

        {/* Table */}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${stageBadgeColor(ref.stage)}`}>
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
