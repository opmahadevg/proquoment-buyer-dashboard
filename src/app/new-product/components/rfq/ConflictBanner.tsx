import React from 'react';
import { RFQConflict } from '@/lib/rfq/types';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

interface ConflictBannerProps {
  conflict: RFQConflict;
  onResolve: (id: string, resolution: string, source: 'ai' | 'buyer') => void;
  onDismiss?: (id: string) => void;
}

export function ConflictBanner({ conflict, onResolve, onDismiss }: ConflictBannerProps) {
  if (conflict.resolved) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, scale: 0.95, height: 0 }}
        className="mb-4 overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/10 shadow-sm"
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <AlertCircle size={18} />
              <h4 className="font-medium text-sm">Conflicting Info: {conflict.field.split('.').pop()}</h4>
            </div>
            {onDismiss && (
              <button 
                onClick={() => onDismiss(conflict.id)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <p className="text-sm text-gray-300 mb-3">
            We found different information for this field. Please select the correct one:
          </p>
          
          <div className="flex flex-col gap-2">
            {conflict.sources.map((source, i) => (
              <button
                key={i}
                onClick={() => onResolve(conflict.id, source.value, 'buyer')}
                className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/50 hover:border-amber-500/50 hover:bg-gray-800 transition-all text-left"
              >
                <div>
                  <span className="block text-xs text-gray-400 uppercase tracking-wider">{source.label}</span>
                  <span className="block text-sm font-medium text-gray-200 mt-0.5">{source.value}</span>
                </div>
                <CheckCircle size={16} className="text-gray-500 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
