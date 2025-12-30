import { Badge } from '@/components/ui/badge';
import { Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { OrderStatus } from '@/types';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    icon: React.ElementType;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    bgColor: string;
  }
> = {
  Pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary',
    bgColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  Processing: {
    label: 'Processing',
    icon: Package,
    variant: 'default',
    bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  Shipped: {
    label: 'Shipped',
    icon: Truck,
    variant: 'default',
    bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  },
  Delivered: {
    label: 'Delivered',
    icon: CheckCircle,
    variant: 'default',
    bgColor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  Cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    variant: 'destructive',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={`${config.bgColor} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default OrderStatusBadge;
