'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Package, FileText, ArrowRight } from 'lucide-react';
import RFQStatusTimeline from './RFQStatusTimeline';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface RFQDetailProps {
  rfq: {
    id: string; product: string; buyer: string; qty: string;
    value: string; status: string; date: string;
    assignedSupplier?: string; deadline?: string;
    targetPrice?: string; specs?: string;
  };
  onClose: () => void;
}

export default function RFQDetail({ rfq, onClose }: RFQDetailProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchMatchedQuotes = async () => {
      setLoadingQuotes(true);
      try {
        const { data, error } = await supabase
          .from('quotes')
          .select('*')
          .eq('rfq_id', rfq.id);
        if (!error && data) {
          setQuotes(data);
        }
      } catch (err) {
        console.error('Error fetching matched quotes:', err);
      } finally {
        setLoadingQuotes(false);
      }
    };
    fetchMatchedQuotes();
  }, [rfq.id, supabase]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <span className="font-mono text-xs font-semibold text-primary">{rfq.id}</span>
            <h2 className="text-lg font-bold text-gray-800">{rfq.product}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Status Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status Progress</h3>
            <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4">
              <RFQStatusTimeline 
                status={rfq.status} 
                assignedSupplier={rfq.assignedSupplier} 
                date={rfq.date} 
              />
            </div>
          </div>

          {/* Details Grid */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">RFQ Specifications</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2.5 p-3 border border-gray-100 rounded-xl bg-white">
                <Package size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Quantity</span>
                  <span className="text-sm font-semibold text-gray-800">{rfq.qty}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 border border-gray-100 rounded-xl bg-white">
                <DollarSign size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <span className="text-[10px] text-gray-400 block font-medium">Est. Value</span>
                  <span className="text-sm font-semibold text-gray-800">{rfq.value || 'TBD'}</span>
                </div>
              </div>
              {rfq.targetPrice && (
                <div className="flex items-start gap-2.5 p-3 border border-gray-100 rounded-xl bg-white">
                  <DollarSign size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium">Target Price/Unit</span>
                    <span className="text-sm font-semibold text-gray-800">{rfq.targetPrice}</span>
                  </div>
                </div>
              )}
              {rfq.deadline && (
                <div className="flex items-start gap-2.5 p-3 border border-gray-100 rounded-xl bg-white">
                  <Calendar size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium">Deadline</span>
                    <span className="text-sm font-semibold text-amber-600">{rfq.deadline}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Specifications Notes */}
          {rfq.specs && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Specifications & Notes</h3>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{rfq.specs}</p>
              </div>
            </div>
          )}

          {/* Matched Quotes Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Supplier Quotations</h3>
            {loadingQuotes ? (
              <div className="text-center py-6 text-xs text-gray-400">Loading matched quotes...</div>
            ) : quotes.length === 0 ? (
              <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400">
                <FileText size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">No quotes received yet. Admin is preparing options.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div key={quote.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm hover:border-primary/20 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-mono text-[10px] font-semibold text-gray-400">{quote.id}</span>
                        <div className="text-xs font-semibold text-gray-800">
                          Unit Price: <span className="text-emerald-600">${quote.landed_cost_per_unit}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {quote.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-3">
                      <span>QC Fee: ${quote.qc_fee}</span>
                      <span>Freight: ${quote.freight_cost}</span>
                      <span className="col-span-2 font-semibold text-gray-700 mt-1">
                        Total Value: ${quote.total_value?.toLocaleString()}
                      </span>
                    </div>
                    <Link 
                      href="/quotes" 
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:gap-1.5 transition-all"
                    >
                      Go to Quote Sheet <ArrowRight size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
