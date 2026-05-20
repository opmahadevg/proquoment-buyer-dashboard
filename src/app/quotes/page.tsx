'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { fetchBuyerQuotes, acceptQuote, rejectQuote } from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Check, X, Clock, FileText, DollarSign, TrendingUp } from 'lucide-react';

interface Quote {
  id: string; rfqId: string; orderId?: string; supplierId?: string;
  supplierUnitPrice: number; qty: number;
  qcFee: number; docFee: number; freightCost: number;
  insurance: number; marginPct: number;
  landedCostPerUnit: number; totalValue: number;
  validityDays: number; status: string;
  sentAt?: string; createdAt?: string;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotes();

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('buyer-quotes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes' },
        async () => {
          const data = await fetchBuyerQuotes();
          setQuotes(data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadQuotes = async () => {
    setLoading(true);
    const data = await fetchBuyerQuotes();
    setQuotes(data);
    setLoading(false);
  };

  const handleAccept = async (q: Quote) => {
    try {
      await acceptQuote(q.id, q.rfqId);
      toast.success(`Quote ${q.id} accepted — Admin notified`);
      loadQuotes();
    } catch { toast.error('Failed to accept'); }
  };

  const handleReject = async (q: Quote) => {
    try {
      await rejectQuote(q.id, q.rfqId);
      toast.success(`Quote ${q.id} rejected`);
      loadQuotes();
    } catch { toast.error('Failed to reject'); }
  };

  const sent = quotes.filter(q => q.status === 'sent');
  const accepted = quotes.filter(q => q.status === 'accepted');
  const rejected = quotes.filter(q => q.status === 'rejected');

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">Procurement</p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Quotes & Pricing</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Review landed-cost quotes from Admin and accept or request revisions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Clock size={18} className="text-blue-600" /></div>
            <div><p className="text-xs text-[var(--muted-foreground)]">Pending Review</p><p className="text-xl font-bold">{sent.length}</p></div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Check size={18} className="text-emerald-600" /></div>
            <div><p className="text-xs text-[var(--muted-foreground)]">Accepted</p><p className="text-xl font-bold text-emerald-600">{accepted.length}</p></div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><X size={18} className="text-red-500" /></div>
            <div><p className="text-xs text-[var(--muted-foreground)]">Rejected</p><p className="text-xl font-bold text-red-500">{rejected.length}</p></div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">Loading quotes...</div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={40} className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-sm text-[var(--muted-foreground)]">No quotes received yet. Submit an RFQ to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Quotes — Full Detail */}
            {sent.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2"><Clock size={14} /> Awaiting Your Decision</h2>
                {sent.map(q => (
                  <div key={q.id} className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-primary">{q.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">PENDING REVIEW</span>
                        <span className="text-xs text-[var(--muted-foreground)]">RFQ: {q.rfqId}</span>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)]">Valid: {q.validityDays} days</span>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase mb-3">Landed Cost Breakdown</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div><p className="text-[10px] text-[var(--muted-foreground)]">UNIT PRICE</p><p className="text-sm font-bold font-mono">${q.supplierUnitPrice?.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-[var(--muted-foreground)]">QC FEE</p><p className="text-sm font-mono">${q.qcFee?.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-[var(--muted-foreground)]">FREIGHT</p><p className="text-sm font-mono">${q.freightCost?.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-[var(--muted-foreground)]">INSURANCE</p><p className="text-sm font-mono">${q.insurance?.toFixed(2)}</p></div>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Landed Cost/Unit</p>
                          <p className="text-2xl font-extrabold text-primary font-mono">${q.landedCostPerUnit?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Total Order Value</p>
                          <p className="text-lg font-bold font-mono">${q.totalValue?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Quantity</p>
                          <p className="text-lg font-bold font-mono">{q.qty?.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(q)} className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors">
                          <X size={14} /> Reject
                        </button>
                        <button onClick={() => handleAccept(q)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
                          <Check size={14} /> Accept Quote
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Accepted / Rejected */}
            {[...accepted, ...rejected].length > 0 && (
              <>
                <h2 className="text-sm font-bold text-[var(--foreground)] mt-6 flex items-center gap-2"><FileText size={14} /> Past Quotes</h2>
                {[...accepted, ...rejected].map(q => (
                  <div key={q.id} className="bg-white border border-[var(--border)] rounded-xl p-4 opacity-80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold">{q.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${q.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {q.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">RFQ: {q.rfqId}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono">${q.landedCostPerUnit?.toFixed(2)}/unit</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Total: ${q.totalValue?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
