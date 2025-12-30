'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cancelOrder } from '@/lib/actions/order.actions';
import { Loader, XCircle } from 'lucide-react';
import { OrderStatus } from '@/types';

interface CancelOrderButtonProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function CancelOrderButton({ orderId, currentStatus }: CancelOrderButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Only show cancel button for Pending or Processing orders
  const canCancel = currentStatus === 'Pending' || currentStatus === 'Processing';

  if (!canCancel) {
    return null;
  }

  const handleCancel = () => {
    startTransition(async () => {
      const res = await cancelOrder(orderId);

      toast({
        variant: res.success ? 'default' : 'destructive',
        description: res.message,
      });

      if (res.success) {
        setOpen(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <XCircle className="h-4 w-4 mr-2" />
          Cancel Order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Order</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this order? This action cannot be undone.
            {currentStatus === 'Processing' && (
              <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
                Note: This order is already being processed. Please contact support if you need help.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Order</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader className="animate-spin h-4 w-4 mr-2" />}
            Yes, Cancel Order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelOrderButton;
