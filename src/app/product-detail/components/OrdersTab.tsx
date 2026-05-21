import React from 'react';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { Order, OrderStep } from '@/lib/productDetailData';

interface OrdersTabProps {
  orders: Order[];
  steps: OrderStep[];
}

const STEP_ICONS = [CheckCircle, Package, Clock, Truck, CheckCircle];

export default function OrdersTab({ orders, steps }: OrdersTabProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">
        {orders?.length} Order{orders?.length !== 1 ? 's' : ''}
      </h3>
      {orders?.map((order) => (
        <div
          key={order?.id}
          className="bg-white border border-[var(--border)] rounded-xl overflow-hidden mb-4"
        >
          <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--secondary)] flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {order?.orderNumber}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {order?.description}
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${order?.statusColor}`}>
              {order?.status}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-4 border-b border-[var(--border)]">
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Supplier</p>
              <p className="text-sm font-medium text-[var(--foreground)]">{order?.supplier}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Placed</p>
              <p className="text-sm font-medium text-[var(--foreground)]">{order?.placedDate}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Est. Delivery</p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {order?.estimatedDelivery}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] mb-0.5">Amount</p>
              <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                {order?.amount}
              </p>
            </div>
          </div>
          {/* Progress steps */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-0">
              {steps?.map((step, i) => {
                const StepIcon = STEP_ICONS[i] ?? CheckCircle;
                return (
                  <React.Fragment key={step?.id}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          step?.done
                            ? 'bg-primary text-white'
                            : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                        }`}
                      >
                        <StepIcon size={14} />
                      </div>
                      <span
                        className={`text-xs text-center max-w-[72px] leading-tight ${step?.done ? 'text-primary font-medium' : 'text-[var(--muted-foreground)]'}`}
                      >
                        {step?.label}
                      </span>
                    </div>
                    {i < steps?.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mb-5 transition-colors ${
                          steps?.[i + 1]?.done ? 'bg-primary' : 'bg-[var(--border)]'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
