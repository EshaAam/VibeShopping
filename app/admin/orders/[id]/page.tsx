import { getOrderById } from '@/lib/data/order';
import { notFound, redirect } from 'next/navigation';
import { Order, ShippingAddress } from '@/types';
import AdminOrderDetailsTable from './admin-order-details-table';
import { isAdmin } from '@/lib/auth-guard';

export const metadata = {
  title: 'Admin - Order Details',
};

const AdminOrderDetailsPage = async (props: {
  params: Promise<{
    id: string;
  }>;
}) => {
  const params = await props.params;
  const { id } = params;

  // Only admins can access this page
  if (!(await isAdmin())) {
    redirect('/');
  }

  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <AdminOrderDetailsTable
      order={{
        ...order,
        shippingAddress: order.shippingAddress as ShippingAddress,
      } as unknown as Order}
    />
  );
};

export default AdminOrderDetailsPage;
