import { getOrderById } from '@/lib/actions/order.actions';
import { notFound, redirect } from 'next/navigation';
import { ShippingAddress } from '@/types';
import AdminOrderDetailsTable from './admin-order-details-table';
import { auth } from '@/auth';

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

  const session = await auth();
  
  // Only admins can access this page
  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }

  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <AdminOrderDetailsTable
      order={{
        ...order,
        shippingAddress: order.shippingAddress as ShippingAddress,
      } as any}
    />
  );
};

export default AdminOrderDetailsPage;
