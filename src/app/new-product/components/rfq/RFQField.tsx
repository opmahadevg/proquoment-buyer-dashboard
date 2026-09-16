import React, { useState } from 'react';
import { ProvenancedField, SizeRunMatrix } from '@/lib/rfq/types';
import { CheckCircle, Eye, Sparkles, FileText, User } from 'lucide-react';
import { SizeRunGrid } from './SizeRunGrid';
import { parseSizeRunText } from '@/lib/rfq/synthesizer/size-run-parser';

interface RFQFieldProps {
  label: string;
  field: ProvenancedField | null;
  renderType?: string;
  onEdit?: (newValue: string) => void;
  onUpdateSizeRun?: (matrix: SizeRunMatrix) => void;
}

export function RFQField({ label, field, renderType, onEdit, onUpdateSizeRun }: RFQFieldProps) {
  if (!field || !field.value) {
    return (
      <div className="flex flex-col py-2 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
        <span className="text-sm text-gray-300 italic">Pending...</span>
      </div>
    );
  }

  let Icon = Sparkles;
  let badgeClass = 'text-indigo-500 bg-indigo-50 border-indigo-100';
  let badgeText = 'AI Proposed';

  if (field.source_type === 'buyer_edit' || field.source_type === 'buyer_message' || field.buyer_confirmed) {
    Icon = User;
    badgeClass = 'text-green-600 bg-green-50 border-green-100';
    badgeText = 'Confirmed';
  } else if (field.source_type === 'uploaded_document') {
    Icon = FileText;
    badgeClass = 'text-purple-600 bg-purple-50 border-purple-100';
    badgeText = 'Extracted';
  } else if (field.source_type === 'visual_inferred' || field.source_type === 'visual_confirmed') {
    Icon = Eye;
    badgeClass = 'text-cyan-600 bg-cyan-50 border-cyan-100';
    badgeText = 'Visual AI';
  }

  const isSizeGrid = renderType === 'size_grid' || label.toLowerCase().includes('size range') || label.toLowerCase().includes('size breakdown');

  return (
    <div className="flex flex-col py-2 border-b border-gray-100 group">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
        <div className={`flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full border ${badgeClass}`}>
          <Icon size={9} />
          {badgeText}
        </div>
      </div>

      {isSizeGrid ? (
        <div>
          <span className="text-xs text-zinc-500 font-mono mb-1 block">{field.value}</span>
          <SizeRunGrid
            matrix={parseSizeRunText(field.value)}
            onUpdate={(matrix) => {
              if (onUpdateSizeRun) onUpdateSizeRun(matrix);
              if (onEdit) {
                const formatted = matrix.entries.map(e => `${e.size_label}: ${e.quantity}`).join(', ');
                onEdit(formatted);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#0D0D14] font-medium">{field.value}</span>
          {onEdit && (
            <button
              onClick={() => {
                const val = prompt(`Edit ${label}`, field.value || '');
                if (val !== null) onEdit(val);
              }}
              className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-indigo-50 rounded"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
