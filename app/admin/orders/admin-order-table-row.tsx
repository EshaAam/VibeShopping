'use client';

import { Order } from '@/types';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateTime, formatId } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InvoiceDialog } from '@/components/shared/invoice';
import DeleteDialog from '@/components/shared/delete-dialog';
import { deleteOrder } from '@/lib/actions/order.actions';

interface AdminOrderTableRowProps {
  order: Order;
}

const AdminOrderTableRow = ({ order }: AdminOrderTableRowProps) => {
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
        {order.isDelivered && order.deliveredAt
          ? formatDateTime(order.deliveredAt).dateTime
          : 'Not Delivered'}
      </TableCell>
      <TableCell className="flex gap-1 items-center">
        <Button asChild variant="outline" size="sm">
          <Link href={`/order/${order.id}`}>Details</Link>
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
