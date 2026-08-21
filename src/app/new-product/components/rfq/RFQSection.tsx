import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface RFQSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function RFQSection({ title, defaultOpen = true, children }: RFQSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left hover:bg-gray-50 transition-colors rounded px-2 -mx-2"
      >
        <h3 className="text-sm font-semibold text-[#0D0D14]">{title}</h3>
        {isOpen ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 pl-1">
          {children}
        </div>
      )}
    </div>
  );
}
