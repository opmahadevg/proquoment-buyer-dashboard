import React from 'react';
import { CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { RFQState } from '@/lib/rfq/types';
import { RFQField } from './rfq/RFQField';
import { RFQSection } from './rfq/RFQSection';
import { ConflictBanner } from './rfq/ConflictBanner';

export function RFQPanel({
  rfqState,
  rfqTitle,
  finalized,
  isLoading,
  onFinalize,
  onResolveConflict,
  onGenerateVisual,
}: {
  rfqState: RFQState;
  rfqTitle: string;
  finalized: boolean;
  isLoading: boolean;
  onFinalize: () => void;
  onResolveConflict?: (id: string, resolution: string) => void;
  onGenerateVisual?: () => void;
}) {
  const { product, quantity, specifications, manufacturing, quality, compliance, commercial, logistics, packaging, special_requirements, conflicts, synthesized, assumption_register } = rfqState;

  const completionPct = synthesized?.supplier_readiness_pct || 0;
  const hasBasicInfo = product.name?.value || product.classification || quantity.required_quantity?.value;

  return (
    <div className="flex flex-col h-full bg-white text-gray-800 border-l border-gray-100">
      {/* Panel header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-[#0D0D14] leading-snug mb-1">
          {synthesized?.product.normalized_product_name || rfqTitle || 'New Product RFQ'}
        </h2>
        {synthesized?.readiness_summary && (
          <p className="text-[11px] font-medium text-gray-500 mb-2">
            {synthesized.readiness_summary}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${completionPct}%`,
                backgroundColor: completionPct >= 70 ? '#22c55e' : '#6366f1',
              }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${completionPct >= 70 ? 'text-green-600' : 'text-indigo-500'}`}>
            {completionPct}%
          </span>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">
        {/* Conflicts */}
        {conflicts.map(conflict => (
          <ConflictBanner
            key={conflict.id}
            conflict={conflict}
            onResolve={(id, resolution) => onResolveConflict?.(id, resolution)}
          />
        ))}

        {/* Basic info */}
        {hasBasicInfo ? (
          <RFQSection title="Product Overview" defaultOpen={true}>
            {rfqState.visual_intent?.confirmed_visual_url ? (
              <div className="mb-3.5 p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-indigo-200/80 bg-white flex-shrink-0 shadow-sm">
                  <img
                    src={rfqState.visual_intent.confirmed_visual_url}
                    alt="Confirmed Product Concept"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[#3B35E8] text-xs font-semibold">
                    <CheckCircle size={13} className="text-[#3B35E8]" />
                    <span>Visual Confirmed</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    Buyer approved interpretation
                  </p>
                </div>
              </div>
            ) : onGenerateVisual ? (
              <div className="mb-3.5 p-2.5 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 border border-indigo-100/80 rounded-xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-white border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Sparkles size={12} className="text-[#3B35E8]" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-gray-800 font-medium block truncate">AI Visual Concept</span>
                    <span className="text-[10px] text-gray-500 block truncate">Inspect design interpretation</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onGenerateVisual}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#3B35E8] hover:bg-[#322dc7] active:scale-95 rounded-lg shadow-xs transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={11} />
                  <span>Preview</span>
                </button>
              </div>
            ) : null}
            <RFQField label="Product Name" field={product.name} />
            <RFQField label="Category" field={
              product.classification ? {
                value: synthesized?.product.category_path?.join(' > ') || product.classification.broad_category,
                status: 'confirmed',
                confidence: 'high',
                source_type: 'ai_proposal',
                source_id: null,
                buyer_confirmed: true,
                supplier_proposed: false,
                updated_at: new Date().toISOString()
              } : null
            } />
            <RFQField label="Intended Use" field={product.intended_use} />
            <RFQField label="Description" field={
              synthesized?.product.synthesized_description ? {
                value: synthesized.product.synthesized_description,
                status: 'confirmed',
                confidence: 'high',
                source_type: 'ai_proposal',
                source_id: null,
                buyer_confirmed: true,
                supplier_proposed: false,
                updated_at: new Date().toISOString()
              } : product.description
            } />
            <RFQField label="Target Quantity" field={quantity.required_quantity} />
            <RFQField label="Buyer Segment" field={product.buyer_segment} />
          </RFQSection>
        ) : (
          <p className="text-sm text-gray-400 italic mb-4">
            Product details will appear here as the conversation progresses…
          </p>
        )}

        {/* Specifications */}
        {Object.keys(specifications).length > 0 && (
          <RFQSection title="Specifications" defaultOpen={true}>
            {Object.entries(specifications).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Manufacturing */}
        {Object.keys(manufacturing).length > 0 && (
          <RFQSection title="Manufacturing Notes" defaultOpen={false}>
            {Object.entries(manufacturing).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Quality */}
        {quality && Object.keys(quality).length > 0 && (
          <RFQSection title="Quality Requirements" defaultOpen={false}>
            {Object.entries(quality).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Compliance */}
        {compliance && Object.keys(compliance).length > 0 && (
          <RFQSection title="Compliance & Certifications" defaultOpen={false}>
            {Object.entries(compliance).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Logistics */}
        {logistics && Object.keys(logistics).length > 0 && (
          <RFQSection title="Logistics & Delivery" defaultOpen={false}>
            {Object.entries(logistics).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Packaging */}
        {packaging && Object.keys(packaging).length > 0 && (
          <RFQSection title="Packaging" defaultOpen={false}>
            {Object.entries(packaging).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Commercial */}
        {Object.keys(commercial).length > 0 && (
          <RFQSection title="Commercial Terms" defaultOpen={false}>
            {Object.entries(commercial).map(([key, field]) => (
              <RFQField key={key} label={key.replace(/_/g, ' ')} field={field} />
            ))}
          </RFQSection>
        )}

        {/* Assumption Register */}
        {assumption_register && (assumption_register.supplier_dependent.length > 0 || assumption_register.unknown.length > 0 || assumption_register.ai_inferred.length > 0) && (
          <RFQSection title="Assumption Register" defaultOpen={true}>
            <div className="space-y-3 px-1 py-1">
              {assumption_register.ai_inferred.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">AI Inferred</h4>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
                    {assumption_register.ai_inferred.map(f => (
                      <li key={f.field}>{f.label}: {f.value}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assumption_register.supplier_dependent.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Supplier Will Propose</h4>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
                    {assumption_register.supplier_dependent.map(f => (
                      <li key={f.field}>{f.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              {assumption_register.unknown.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Missing / TBD</h4>
                  <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
                    {assumption_register.unknown.map(f => (
                      <li key={f.field}>
                        {f.label} {f.criticality === 'critical' ? <span className="text-red-500 font-bold ml-1">*</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </RFQSection>
        )}
      </div>

      {/* Finalize button */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60">
        <button
          onClick={onFinalize}
          disabled={finalized || isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0D0D14] text-white rounded-xl text-sm font-semibold hover:bg-[#1a1a26] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {finalized ? (
            <>
              <CheckCircle size={15} /> RFQ Finalized!
            </>
          ) : (
            <>
              <ChevronRight size={15} /> Finalize &amp; Add to Products
            </>
          )}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2">Adds product to your sourcing list</p>
      </div>
    </div>
  );
}
