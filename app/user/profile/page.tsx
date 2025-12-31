import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import { prisma } from '@/db/prisma';
import ProfileDashboard from './profile-dashboard';

export const metadata: Metadata = {
  title: 'My Dashboard',
};

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect('/sign-in');
  }

  // Fetch user data with counts
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: {
        select: {
          Order: true,
          wishlists: true,
        },
      },
      Order: {
        where: {
          orderStatus: {
            in: ['Pending', 'Processing', 'Shipped'],
          },
        },
        select: { id: true },
      },
      account: {
        select: {
          provider: true,
        },
      },
    },
  });

  if (!user) {
    redirect('/sign-in');
  }

  // Get wishlist item count
  const wishlist = await prisma.wishlist.findFirst({
    where: { userId: session.user.id },
  });

  const wishlistItemCount = wishlist?.items
    ? (wishlist.items as unknown[]).length
    : 0;

  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    address: user.address as {
      fullName?: string;
      streetAddress?: string;
      city?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    } | null,
    paymentMethod: user.paymentMethod,
    totalOrders: user._count.Order,
    activeOrders: user.Order.length,
    wishlistItems: wishlistItemCount,
    providers: user.account.map((a: { provider: string }) => a.provider),
  };

  return (
    <SessionProvider session={session}>
      <ProfileDashboard user={userData} />
    </SessionProvider>
  );
}
