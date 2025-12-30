'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateOrderStatus } from '@/lib/actions/order.actions';
import { Loader, Settings } from 'lucide-react';
import { OrderStatus } from '@/types';

interface UpdateOrderStatusDialogProps {
  orderId: string;
  currentStatus: OrderStatus;
}

const statusOptions: Record<OrderStatus, OrderStatus[]> = {
  Pending: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

export function UpdateOrderStatusDialog({
  orderId,
  currentStatus,
}: UpdateOrderStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const availableStatuses = statusOptions[currentStatus];

  const handleSubmit = () => {
    if (!newStatus) {
      toast({
        variant: 'destructive',
        description: 'Please select a status',
      });
      return;
    }

    startTransition(async () => {
      const res = await updateOrderStatus(
        orderId,
        newStatus,
        trackingNumber || undefined
      );

      toast({
        variant: res.success ? 'default' : 'destructive',
        description: res.message,
      });

      if (res.success) {
        setOpen(false);
        setNewStatus('');
        setTrackingNumber('');
      }
    });
  };

  if (availableStatuses.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Update Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Change the order status to the next stage in the fulfillment process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div className="text-sm font-medium text-muted-foreground px-3 py-2 bg-muted rounded-md">
              {currentStatus}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select
              value={newStatus}
              onValueChange={(value) => setNewStatus(value as OrderStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newStatus === 'Shipped' && (
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number (Optional)</Label>
              <Input
                id="tracking"
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !newStatus}>
            {isPending && <Loader className="animate-spin h-4 w-4 mr-2" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateOrderStatusDialog;
