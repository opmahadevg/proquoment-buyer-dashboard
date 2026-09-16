'use client';
import React, { useState } from 'react';
import { Plus, Trash2, SlidersHorizontal, Check } from 'lucide-react';
import { SizeRunEntry, SizeRunMatrix } from '@/lib/rfq/types';

interface SizeRunGridProps {
  matrix?: SizeRunMatrix | null;
  initialText?: string;
  onUpdate?: (updatedMatrix: SizeRunMatrix) => void;
  readOnly?: boolean;
}

export const SizeRunGrid: React.FC<SizeRunGridProps> = ({
  matrix: propMatrix,
  initialText,
  onUpdate,
  readOnly = false,
}) => {
  const [entries, setEntries] = useState<SizeRunEntry[]>(() => {
    if (propMatrix?.entries && propMatrix.entries.length > 0) {
      return propMatrix.entries;
    }
    // Default standard denim sizes
    return [
      { size_label: '30x32', quantity: 525, waist: 30, inseam: 32 },
      { size_label: '32x32', quantity: 1050, waist: 32, inseam: 32 },
      { size_label: '34x32', quantity: 1050, waist: 34, inseam: 32 },
      { size_label: '36x32', quantity: 525, waist: 36, inseam: 32 },
      { size_label: '38x32', quantity: 350, waist: 38, inseam: 32 },
    ];
  });

  const [showPOM, setShowPOM] = useState(true);

  const totalQuantity = entries.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);

  const notifyChange = (newEntries: SizeRunEntry[]) => {
    setEntries(newEntries);
    if (onUpdate) {
      const sum = newEntries.reduce((acc, e) => acc + (Number(e.quantity) || 0), 0);
      onUpdate({
        entries: newEntries,
        total_quantity: sum,
        size_system: newEntries.some(e => e.waist) ? 'US' : 'Custom',
        has_pom: newEntries.some(e => e.waist && e.inseam),
      });
    }
  };

  const handleCellChange = (index: number, field: keyof SizeRunEntry, val: string) => {
    const updated = [...entries];
    const target = { ...updated[index] };

    if (field === 'quantity' || field === 'waist' || field === 'inseam') {
      const num = parseInt(val, 10);
      target[field] = isNaN(num) ? 0 : num;
    } else {
      target.size_label = val;
    }

    updated[index] = target;
    notifyChange(updated);
  };

  const handleAddRow = () => {
    const newEntry: SizeRunEntry = {
      size_label: '40x32',
      quantity: 100,
      waist: 40,
      inseam: 32,
    };
    notifyChange([...entries, newEntry]);
  };

  const handleDeleteRow = (index: number) => {
    if (entries.length <= 1) return;
    const updated = entries.filter((_, i) => i !== index);
    notifyChange(updated);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 mt-2">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Garment Size Breakdown ({entries.length} sizes)
        </span>
        <button
          type="button"
          onClick={() => setShowPOM(!showPOM)}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-indigo-600 transition-colors"
        >
          <SlidersHorizontal size={12} />
          {showPOM ? 'Hide Measurements' : 'Show Measurements (POM)'}
        </button>
      </div>

      {/* Distribution visual bar */}
      {totalQuantity > 0 && (
        <div className="h-2.5 w-full flex rounded-md overflow-hidden mb-3 bg-zinc-100 dark:bg-zinc-800">
          {entries.map((entry, i) => {
            const pct = (entry.quantity / totalQuantity) * 100;
            const colors = [
              'bg-blue-500',
              'bg-indigo-500',
              'bg-violet-500',
              'bg-teal-500',
              'bg-amber-500',
              'bg-rose-500',
            ];
            return (
              <div
                key={i}
                style={{ width: `${pct}%` }}
                className={`${colors[i % colors.length]} transition-all`}
                title={`${entry.size_label}: ${entry.quantity} units (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Size Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <th className="py-1.5 px-2 font-medium">Size</th>
              <th className="py-1.5 px-2 font-medium">Units</th>
              {showPOM && (
                <>
                  <th className="py-1.5 px-2 font-medium">Waist</th>
                  <th className="py-1.5 px-2 font-medium">Inseam</th>
                </>
              )}
              <th className="py-1.5 px-2 font-medium text-right">Share</th>
              {!readOnly && <th className="py-1.5 px-2 font-medium w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {entries.map((row, index) => {
              const sharePct = totalQuantity > 0 ? ((row.quantity / totalQuantity) * 100).toFixed(0) : '0';
              return (
                <tr key={index} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                  <td className="py-1.5 px-2">
                    {readOnly ? (
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{row.size_label}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.size_label}
                        onChange={(e) => handleCellChange(index, 'size_label', e.target.value)}
                        className="w-16 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs"
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? (
                      <span>{row.quantity.toLocaleString()}</span>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleCellChange(index, 'quantity', e.target.value)}
                        className="w-20 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium text-xs"
                      />
                    )}
                  </td>
                  {showPOM && (
                    <>
                      <td className="py-1.5 px-2 text-zinc-500">
                        {readOnly ? (
                          <span>{row.waist ? `${row.waist}"` : '-'}</span>
                        ) : (
                          <input
                            type="number"
                            placeholder='waist"'
                            value={row.waist || ''}
                            onChange={(e) => handleCellChange(index, 'waist', e.target.value)}
                            className="w-14 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-xs"
                          />
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-zinc-500">
                        {readOnly ? (
                          <span>{row.inseam ? `${row.inseam}"` : '-'}</span>
                        ) : (
                          <input
                            type="number"
                            placeholder='inseam"'
                            value={row.inseam || ''}
                            onChange={(e) => handleCellChange(index, 'inseam', e.target.value)}
                            className="w-14 px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-xs"
                          />
                        )}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 px-2 text-right font-medium text-zinc-400">
                    {sharePct}%
                  </td>
                  {!readOnly && (
                    <td className="py-1.5 px-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(index)}
                        disabled={entries.length <= 1}
                        className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                        title="Delete size"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-900 dark:text-zinc-100">
              <td className="py-2 px-2">Total Order</td>
              <td className="py-2 px-2 text-indigo-600 dark:text-indigo-400">
                {totalQuantity.toLocaleString()} pcs
              </td>
              {showPOM && <td colSpan={2}></td>}
              <td className="py-2 px-2 text-right">100%</td>
              {!readOnly && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus size={13} /> Add Size
          </button>
          <span className="text-[11px] text-zinc-400">Factory spec sheet format</span>
        </div>
      )}
    </div>
  );
};
