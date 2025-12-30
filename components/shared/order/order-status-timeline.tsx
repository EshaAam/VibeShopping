'use client';

import { Clock, Package, Truck, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types';

interface OrderStatusTimelineProps {
  currentStatus: OrderStatus;
  className?: string;
}

const statusSteps = [
  { status: 'Pending', label: 'Order Placed', icon: Clock },
  { status: 'Processing', label: 'Processing', icon: Package },
  { status: 'Shipped', label: 'Shipped', icon: Truck },
  { status: 'Delivered', label: 'Delivered', icon: CheckCircle },
];

export function OrderStatusTimeline({ currentStatus, className }: OrderStatusTimelineProps) {
  // Handle cancelled orders
  if (currentStatus === 'Cancelled') {
    return (
      <div className={cn('w-full py-4 text-center', className)}>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-lg">
          <span className="text-lg">❌</span>
          <span className="font-medium">This order has been cancelled</span>
        </div>
      </div>
    );
  }

  const currentIndex = statusSteps.findIndex((step) => step.status === currentStatus);

  return (
    <div className={cn('w-full py-6', className)}>
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {statusSteps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.status} className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background border-muted-foreground/30 text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p
                  className={cn(
                    'font-medium',
                    isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-xs text-muted-foreground">Current status</p>
                )}
              </div>
              {isCompleted && <span className="text-green-500">✓</span>}
            </div>
          );
        })}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-muted -z-10 mx-12">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(currentIndex / (statusSteps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Status Steps */}
          {statusSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={step.status} className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p
                  className={cn(
                    'mt-2 text-sm font-medium text-center',
                    isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <span className="text-xs text-primary mt-1">Current</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default OrderStatusTimeline;
