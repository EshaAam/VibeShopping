'use client';

import { Order, OrderStatus } from '@/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime, formatId } from '@/lib/utils';
import Link from 'next/link';
import { InvoiceDialog } from '@/components/shared/invoice';
import { OrderStatusBadge } from '@/components/shared/order/order-status-badge';

interface OrderTableRowProps {
  order: Order;
}

const OrderTableRow = ({ order }: OrderTableRowProps) => {
  const currentStatus = (order.orderStatus || 'Pending') as OrderStatus;
  
  return (
    <TableRow>
      <TableCell>{formatId(order.id)}</TableCell>
      <TableCell>{formatDateTime(order.createdAt).dateTime}</TableCell>
      <TableCell>{formatCurrency(order.totalPrice)}</TableCell>
      <TableCell>
        {order.isPaid && order.paidAt
          ? formatDateTime(order.paidAt).dateTime
          : 'not paid'}
      </TableCell>
      <TableCell>
        <OrderStatusBadge status={currentStatus} />
      </TableCell>
      <TableCell className="flex items-center gap-2">
        <Link href={`/order/${order.id}`}>
          <span className="px-2 text-blue-600 hover:underline">Details</span>
        </Link>
        {order.isPaid && (
          <InvoiceDialog order={order} variant="outline" size="sm" />
        )}
      </TableCell>
    </TableRow>
  );
};

export default OrderTableRow;
