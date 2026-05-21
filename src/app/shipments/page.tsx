'use client';
import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { fetchBuyerShipments, confirmDelivery } from '@/lib/services/procurementApi';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Ship, MapPin, CheckCircle, Clock, Package } from 'lucide-react';

interface Shipment {
  id: string;
  orderId: string;
  forwarder: string;
  pol: string;
  pod: string;
  incoterms: string;
  bookingRef: string;
  containerNo: string;
  vesselName: string;
  departureDate: string;
  eta: string;
  customsStatus: string;
  deliveryConfirmed: boolean;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShipments();

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('buyer-shipments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, async () => {
        const data = await fetchBuyerShipments();
        setShipments(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadShipments = async () => {
    setLoading(true);
    const data = await fetchBuyerShipments();
    setShipments(data);
    setLoading(false);
  };

  const handleConfirmDelivery = async (shp: Shipment) => {
    try {
      await confirmDelivery(shp.id, shp.orderId);
      toast.success(`Delivery confirmed for ${shp.orderId} — Admin notified`);
      loadShipments();
    } catch {
      toast.error('Failed to confirm delivery');
    }
  };

  const inTransit = shipments.filter((s) => !s.deliveryConfirmed);
  const delivered = shipments.filter((s) => s.deliveryConfirmed);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-1">
            Procurement
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Shipment Tracking</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track your shipments in real time and confirm delivery
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Ship size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">In Transit</p>
              <p className="text-xl font-bold">{inTransit.length}</p>
            </div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Delivered</p>
              <p className="text-xl font-bold text-emerald-600">{delivered.length}</p>
            </div>
          </div>
          <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Customs Pending</p>
              <p className="text-xl font-bold text-amber-600">
                {shipments.filter((s) => s.customsStatus !== 'Pre-cleared').length}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            Loading shipments...
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-30" />
            <p className="text-sm text-[var(--muted-foreground)]">No shipments yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {shipments.map((shp) => (
              <div
                key={shp.id}
                className={`bg-white border rounded-2xl p-5 ${shp.deliveryConfirmed ? 'border-emerald-200 bg-emerald-50/30' : 'border-blue-200'}`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-primary">{shp.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${shp.deliveryConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}
                      >
                        {shp.deliveryConfirmed ? 'DELIVERED' : 'IN TRANSIT'}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Order: {shp.orderId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <MapPin size={14} className="text-[var(--muted-foreground)]" />
                      <span className="text-sm font-semibold">{shp.pol}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">→</span>
                      <span className="text-sm font-semibold">{shp.pod}</span>
                    </div>
                  </div>
                  {!shp.deliveryConfirmed && (
                    <button
                      onClick={() => handleConfirmDelivery(shp)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle size={14} /> Confirm Delivery
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-3">
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      Forwarder
                    </p>
                    <p className="text-xs font-semibold">{shp.forwarder}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Vessel</p>
                    <p className="text-xs font-semibold">{shp.vesselName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      Container
                    </p>
                    <p className="text-xs font-mono font-semibold">{shp.containerNo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      Incoterms
                    </p>
                    <p className="text-xs font-semibold">{shp.incoterms}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      Booking Ref
                    </p>
                    <p className="text-xs font-mono">{shp.bookingRef}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">
                      Departure
                    </p>
                    <p className="text-xs font-semibold">{shp.departureDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">ETA</p>
                    <p className="text-xs font-semibold text-primary">{shp.eta}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase">Customs</p>
                    <p
                      className={`text-xs font-semibold ${shp.customsStatus === 'Pre-cleared' ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {shp.customsStatus}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
