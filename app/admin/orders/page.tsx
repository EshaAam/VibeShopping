import { auth } from '@/auth';
import { getAllOrders } from '@/lib/actions/order.actions';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Pagination from '@/components/shared/pagination';
import AdminOrderTableRow from './admin-order-table-row';
import { Order, ShippingAddress } from '@/types';

export const metadata: Metadata = {
  title: 'Admin Orders',
};

const OrdersPage = async (props: {
  searchParams: Promise<{ page: string; query: string }>;
}) => {
  const searchParams = await props.searchParams;
  const { page = '1', query: searchText = '' } = searchParams;

  const session = await auth();
  if (!session || session?.user.role !== 'admin') {
    redirect('/');
  }

  const orders = await getAllOrders({
    page: Number(page),
    query: searchText,
  });

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-3'>
        <h1 className='h2-bold'>Orders</h1>
        {searchText && (
          <div>
            Filtered by <i>&quot;{searchText}&quot;</i>{' '}
            <Link href={`/admin/orders`}>
              <Button variant='outline' size='sm'>
                Remove Filter
              </Button>
            </Link>
          </div>
        )}
      </div>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>DATE</TableHead>
              <TableHead>TOTAL</TableHead>
              <TableHead>PAID</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead>ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data.map((order) => (
              <AdminOrderTableRow
                key={order.id}
                order={{
                  ...order,
                  shippingAddress: order.shippingAddress as ShippingAddress,
                } as unknown as Order}
              />
            ))}
          </TableBody>
        </Table>
        {orders.totalPages > 1 && (
          <Pagination
            page={Number(page) || 1}
            totalPages={orders?.totalPages}
          />
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
