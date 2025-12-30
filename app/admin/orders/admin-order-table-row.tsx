'use client';

import { Order, OrderStatus } from '@/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime, formatId } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvoiceDialog } from '@/components/shared/invoice';
import DeleteDialog from '@/components/shared/delete-dialog';
import { deleteOrder } from '@/lib/actions/order.actions';
import { OrderStatusBadge } from '@/components/shared/order/order-status-badge';

interface AdminOrderTableRowProps {
  order: Order;
}

const AdminOrderTableRow = ({ order }: AdminOrderTableRowProps) => {
  const currentStatus = (order.orderStatus || 'Pending') as OrderStatus;
  
  return (
    <TableRow>
      <TableCell>{formatId(order.id)}</TableCell>
      <TableCell>{formatDateTime(order.createdAt).dateTime}</TableCell>
      <TableCell>{formatCurrency(order.totalPrice)}</TableCell>
      <TableCell>
        {order.isPaid && order.paidAt
          ? formatDateTime(order.paidAt).dateTime
          : 'Not Paid'}
      </TableCell>
      <TableCell>
        <OrderStatusBadge status={currentStatus} />
      </TableCell>
      <TableCell className="flex gap-1 items-center">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/orders/${order.id}`}>Details</Link>
        </Button>
        {order.isPaid && (
          <InvoiceDialog order={order} variant="outline" size="sm" />
        )}
        <DeleteDialog id={order.id} action={deleteOrder} />
      </TableCell>
    </TableRow>
  );
};

export default AdminOrderTableRow;
