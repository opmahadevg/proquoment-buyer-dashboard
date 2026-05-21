'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { fetchBuyerRFQs, submitRFQ } from '@/lib/services/procurementApi';
import { toast } from 'sonner';
import { Send, Clock, CheckCircle, AlertCircle, Plus, Search, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RFQDetail from '@/components/RFQDetail';

interface RFQ {
  id: string;
  product: string;
  buyer: string;
  qty: string;
  value: string;
  status: string;
  date: string;
  assignedSupplier?: string;
  deadline?: string;
  targetPrice?: string;
  specs?: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  quoted: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};

export default function RFQPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [form, setForm] = useState({
    product: '',
    qty: '',
    value: '',
    targetPrice: '',
    specs: '',
    deadline: '',
    buyer: '',
  });

  useEffect(() => {
    loadRFQs();

    const supabase = createClient();
    const channel = supabase
      .channel('buyer-rfqs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfqs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new;
          const mapped: RFQ = {
            id: newRow.id,
            product: newRow.product,
            buyer: newRow.buyer,
            qty: newRow.qty,
            value: newRow.value,
            status: newRow.status,
            date: newRow.date,
            assignedSupplier: newRow.assigned_supplier,
            deadline: newRow.deadline,
            targetPrice: newRow.target_price,
            specs: newRow.specs,
          };
          setRfqs((prev) => {
            if (prev.some((r) => r.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const newRow = payload.new;
          const mapped: RFQ = {
            id: newRow.id,
            product: newRow.product,
            buyer: newRow.buyer,
            qty: newRow.qty,
            value: newRow.value,
            status: newRow.status,
            date: newRow.date,
            assignedSupplier: newRow.assigned_supplier,
            deadline: newRow.deadline,
            targetPrice: newRow.target_price,
            specs: newRow.specs,
          };
          setRfqs((prev) => prev.map((r) => (r.id === newRow.id ? mapped : r)));
          setSelectedRfq((prev) => (prev && prev.id === newRow.id ? mapped : prev));
        } else if (payload.eventType === 'DELETE') {
          setRfqs((prev) => prev.filter((r) => r.id !== payload.old.id));
          setSelectedRfq((prev) => (prev && prev.id === payload.old.id ? null : prev));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRFQs = async () => {
    setLoading(true);
    const data = await fetchBuyerRFQs();
    setRfqs(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.qty) {
      toast.error('Product and quantity are required');
      return;
    }
    try {
      const id = await submitRFQ(form);
      toast.success(`RFQ ${id} submitted — Admin notified`);
      setShowForm(false);
      setForm({
        product: '',
        qty: '',
        value: '',
        targetPrice: '',
        specs: '',
        deadline: '',
        buyer: '',
      });
      loadRFQs();
    } catch (err) {
      toast.error('Failed to submit RFQ');
    }
  };

  const filtered = rfqs.filter(
    (r) =>
      !search ||
      r.product.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: rfqs.length,
    pending: rfqs.filter((r) => r.status === 'new').length,
    quoted: rfqs.filter((r) => r.status === 'quoted').length,
    accepted: rfqs.filter((r) => r.status === 'accepted').length,
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
              Procurement
            </p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">My Requests for Quote</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Submit sourcing requests and track their progress
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] active:scale-95 transition-all"
          >
            <Plus size={16} /> Submit New RFQ
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Total RFQs</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Pending</p>
            <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Quotes Received
            </p>
            <p className="text-2xl font-bold text-amber-600">{stats.quoted}</p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Accepted</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-lg px-3 py-2 mb-4 max-w-md">
          <Search size={16} className="text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RFQs..."
            className="flex-1 text-sm border-none outline-none bg-transparent"
          />
        </div>

        {/* RFQ List */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText
              size={40}
              className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-30"
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              No RFQs found. Submit your first request!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rfq) => (
              <div
                key={rfq.id}
                onClick={() => setSelectedRfq(rfq)}
                className="bg-white border border-[var(--border)] rounded-xl p-4 hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-primary">{rfq.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[rfq.status] || 'bg-gray-100'}`}
                      >
                        {rfq.status.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-[var(--foreground)]">
                      {rfq.product}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--muted-foreground)]">
                      <span>
                        Qty: <strong className="text-[var(--foreground)]">{rfq.qty}</strong>
                      </span>
                      <span>
                        Value: <strong className="text-[var(--foreground)]">{rfq.value}</strong>
                      </span>
                      <span>Submitted: {rfq.date}</span>
                      {rfq.assignedSupplier && (
                        <span>
                          Supplier:{' '}
                          <strong className="text-[var(--foreground)]">
                            {rfq.assignedSupplier}
                          </strong>
                        </span>
                      )}
                      {rfq.deadline && (
                        <span className="text-amber-600">Deadline: {rfq.deadline}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {rfq.status === 'new' && <Clock size={18} className="text-blue-500" />}
                    {rfq.status === 'quoted' && (
                      <AlertCircle size={18} className="text-amber-500" />
                    )}
                    {rfq.status === 'accepted' && (
                      <CheckCircle size={18} className="text-emerald-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RFQ Detail Drawer */}
        {selectedRfq && <RFQDetail rfq={selectedRfq} onClose={() => setSelectedRfq(null)} />}

        {/* ── Submit RFQ Modal ── */}
        {showForm && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowForm(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-1">Submit Request for Quote</h2>
              <p className="text-xs text-[var(--muted-foreground)] mb-5">
                Admin will review and match you with qualified suppliers
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                    Product Name *
                  </label>
                  <input
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                    placeholder="e.g. Organic Cotton T-Shirts"
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                      Quantity *
                    </label>
                    <input
                      value={form.qty}
                      onChange={(e) => setForm({ ...form, qty: e.target.value })}
                      placeholder="5,000 pcs"
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                      Estimated Value
                    </label>
                    <input
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder="$25,000"
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                      Target Price/Unit
                    </label>
                    <input
                      value={form.targetPrice}
                      onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
                      placeholder="$5.00"
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                    Buyer Name / Company
                  </label>
                  <input
                    value={form.buyer}
                    onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                    placeholder="Your company"
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase">
                    Specifications / Notes
                  </label>
                  <textarea
                    value={form.specs}
                    onChange={(e) => setForm({ ...form, specs: e.target.value })}
                    placeholder="Material, color, certifications, packaging requirements..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg text-sm resize-none"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] transition-colors"
                  >
                    <Send size={14} /> Submit RFQ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
