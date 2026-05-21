'use client';

import React from 'react';
import { Check, Clock, User, FileText, ShoppingBag } from 'lucide-react';

interface RFQStatusTimelineProps {
  status: string;
  assignedSupplier?: string;
  date: string;
}

export default function RFQStatusTimeline({
  status,
  assignedSupplier,
  date,
}: RFQStatusTimelineProps) {
  const steps = [
    {
      id: 'submitted',
      label: 'RFQ Submitted',
      description: `Submitted on ${date}`,
      icon: FileText,
      completed: true,
      active: status === 'new',
    },
    {
      id: 'matching',
      label: 'Supplier Matching',
      description: assignedSupplier
        ? `Assigned to ${assignedSupplier}`
        : 'Matching with top manufacturers',
      icon: User,
      completed: ['assigned', 'quoted', 'accepted'].includes(status),
      active: status === 'assigned',
    },
    {
      id: 'quoted',
      label: 'Quotation Ready',
      description:
        status === 'quoted'
          ? 'Review quotes and proceed'
          : status === 'accepted'
            ? 'Quote accepted'
            : 'Awaiting quote from supplier',
      icon: Clock,
      completed: ['quoted', 'accepted'].includes(status),
      active: status === 'quoted',
    },
    {
      id: 'converted',
      label: 'Order Initiated',
      description:
        status === 'accepted' ? 'Order successfully generated' : 'Purchase agreement pending',
      icon: ShoppingBag,
      completed: status === 'accepted',
      active: status === 'accepted',
    },
  ];

  return (
    <div className="flow-root py-4">
      <ul role="list" className="-mb-8">
        {steps.map((step, stepIdx) => (
          <li key={step.id}>
            <div className="relative pb-8">
              {stepIdx !== steps.length - 1 ? (
                <span
                  className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                    step.completed ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white transition-all duration-300 ${
                      step.completed
                        ? 'bg-emerald-500 text-white'
                        : step.active
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step.completed ? <Check size={16} /> : <step.icon size={16} />}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p
                      className={`text-xs font-semibold ${step.active ? 'text-blue-600' : step.completed ? 'text-gray-800' : 'text-gray-500'}`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{step.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
