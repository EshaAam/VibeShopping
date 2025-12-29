import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMyOrders } from '@/lib/actions/order.actions';
import { Metadata } from 'next';
import Pagination from '@/components/shared/pagination';
import OrderTableRow from './order-table-row';
import { Order, ShippingAddress } from '@/types';

export const metadata: Metadata = {
  title: 'My Orders',
};

const OrdersPage = async (props: {
  searchParams: Promise<{ page: string }>;
}) => {
  const { page } = await props.searchParams;
  const orders = await getMyOrders({
    page: Number(page) || 1,
  });

  return (
    <div className='space-y-2'>
      <h2 className='h2-bold'>Orders</h2>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>DATE</TableHead>
              <TableHead>TOTAL</TableHead>
              <TableHead>PAID</TableHead>
              <TableHead>DELIVERED</TableHead>
              <TableHead>ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.map((order) => (
              <OrderTableRow
                key={order.id}
                order={{
                  ...order,
                  shippingAddress: order.shippingAddress as ShippingAddress,
                } as unknown as Order}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {orders.totalPages > 1 && (
        <Pagination page={Number(page) || 1} totalPages={orders?.totalPages} />
      )}
    </div>
  );
};

export default OrdersPage;