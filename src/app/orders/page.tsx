'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { fetchBuyerOrders, fetchBuyerMilestones } from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Order {
  id: string;
  product: string;
  buyer: string;
  supplier: string;
  supplierCity: string;
  value: string;
  stage: string;
  progress: number;
  days: number;
  eta: string;
  priority: string;
}

const STAGES = [
  'rfq_review',
  'supplier_matching',
  'quote_sent',
  'order_confirmed',
  'production',
  'qc_inspection',
  'export_docs',
  'freight',
  'customs',
  'delivered',
  'closed',
];
const STAGE_LABELS: Record<string, string> = {
  rfq_review: 'RFQ Review',
  supplier_matching: 'Supplier Match',
  quote_sent: 'Quote Sent',
  order_confirmed: 'Confirmed',
  production: 'Production',
  qc_inspection: 'QC',
  export_docs: 'Export Docs',
  freight: 'Freight',
  customs: 'Customs',
  delivered: 'Delivered',
  closed: 'Closed',
};
const STAGE_ICONS: Record<string, any> = {
  delivered: CheckCircle,
  freight: Truck,
  production: Package,
  qc_inspection: AlertTriangle,
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const ordersData = await fetchBuyerOrders();
      const milestonesData = await fetchBuyerMilestones();
      setOrders(ordersData);
      setMilestones(milestonesData);
      setLoading(false);
    };

    loadData();

    const supabase = createClient();
    if (!supabase) return;

    const ordersChannel = supabase
      .channel('buyer-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        const data = await fetchBuyerOrders();
        setOrders(data);
      })
      .subscribe();

    const milestonesChannel = supabase
      .channel('buyer-milestones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, async () => {
        const data = await fetchBuyerMilestones();
        setMilestones(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(milestonesChannel);
    };
  }, []);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.stage === filter);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
            Procurement
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">My Orders</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track all your orders through the procurement pipeline
          </p>
        </div>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Active Orders</p>
            <p className="text-2xl font-bold">
              {orders.filter((o) => !['delivered', 'closed'].includes(o.stage)).length}
            </p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-[var(--muted-foreground)]">In Production</p>
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter((o) => o.stage === 'production').length}
            </p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-[var(--muted-foreground)]">In Transit</p>
            <p className="text-2xl font-bold text-amber-600">
              {orders.filter((o) => ['freight', 'customs'].includes(o.stage)).length}
            </p>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Delivered</p>
            <p className="text-2xl font-bold text-emerald-600">
              {orders.filter((o) => o.stage === 'delivered').length}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {['all', ...STAGES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === s
                  ? 'bg-primary text-white'
                  : 'bg-white border border-[var(--border)] text-[var(--muted-foreground)] hover:border-primary/30'
              }`}
            >
              {s === 'all' ? 'All' : STAGE_LABELS[s] || s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-sm text-[var(--muted-foreground)]">No orders found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => {
              const stageIdx = STAGES.indexOf(order.stage);
              const progress = Math.round(((stageIdx + 1) / STAGES.length) * 100);
              const Icon = STAGE_ICONS[order.stage] || Clock;
              return (
                <div
                  key={order.id}
                  className="bg-white border border-[var(--border)] rounded-2xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {order.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            order.priority === 'urgent'
                              ? 'bg-red-100 text-red-700'
                              : order.priority === 'high'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {order.priority?.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-bold text-[var(--foreground)]">{order.product}</h3>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {order.supplier} · {order.supplierCity} · <strong>{order.value}</strong>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <Icon size={16} className="text-primary" />
                        <span className="text-xs font-semibold text-primary">
                          {STAGE_LABELS[order.stage] || order.stage}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        ETA: {order.eta || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-gradient-to-r from-primary to-blue-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                    <span>RFQ</span>
                    <span>Production</span>
                    <span>QC</span>
                    <span>Freight</span>
                    <span>Delivered</span>
                  </div>

                  {/* Toggle Milestones Button */}
                  {(() => {
                    const orderMilestones = milestones.filter((m) => m.orderId === order.id);
                    const completedMilestones = orderMilestones.filter(
                      (m) => m.status === 'completed'
                    ).length;
                    return (
                      <>
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {orderMilestones.length} milestones ({completedMilestones} completed)
                          </span>
                          <button
                            onClick={() =>
                              setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                            }
                            className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                          >
                            {expandedOrderId === order.id ? (
                              <>
                                Hide Details <ChevronUp size={14} />
                              </>
                            ) : (
                              <>
                                Track Milestones <ChevronDown size={14} />
                              </>
                            )}
                          </button>
                        </div>

                        {expandedOrderId === order.id && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 animate-fadeIn">
                            <h4 className="text-xs font-bold text-[var(--foreground)] mb-3 uppercase tracking-wider">
                              Milestone Timeline
                            </h4>
                            {orderMilestones.length === 0 ? (
                              <p className="text-xs text-[var(--muted-foreground)]">
                                No milestones defined for this order yet.
                              </p>
                            ) : (
                              <div className="relative pl-6 border-l border-gray-200 space-y-4">
                                {orderMilestones.map((m) => {
                                  const isCompleted = m.status === 'completed';
                                  return (
                                    <div key={m.id} className="relative">
                                      {/* Dot */}
                                      <div
                                        className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                          isCompleted
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-blue-400'
                                        }`}
                                      >
                                        {isCompleted && (
                                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                        )}
                                      </div>

                                      <div className="flex justify-between gap-4">
                                        <div>
                                          <h5
                                            className={`text-xs font-bold ${isCompleted ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}
                                          >
                                            {m.title}
                                          </h5>
                                          {m.description && (
                                            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                                              {m.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                              isCompleted
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-blue-100 text-blue-700'
                                            }`}
                                          >
                                            {m.status}
                                          </span>
                                          <p className="text-[9px] text-[var(--muted-foreground)] mt-1">
                                            Target: {m.targetDate || '—'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
