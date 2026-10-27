'use client';
import { Check, Loader } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { placeOrder } from '@/lib/actions/order.actions';
import { useToast } from '@/hooks/use-toast';

const PlaceOrderForm = () => {
  const { toast } = useToast();

  // The action redirects from the server - to the new order, or back to a
  // missing checkout step - so anything it returns is an error to show.
  const handleSubmit = async () => {
    const res = await placeOrder();
    if (res && !res.success) {
      toast({ variant: 'destructive', description: res.message });
    }
  };

  const PlaceOrderButton = () => {
    const { pending } = useFormStatus();
    return (
      <button disabled={pending} className='gradient-btn w-full py-3 px-4 flex items-center justify-center gap-2'>
        {pending ? (
          <Loader className='w-4 h-4 animate-spin' />
        ) : (
          <Check className='w-4 h-4' />
        )}{' '}
        Place Order
      </button>
    );
  };

  return (
    <form action={handleSubmit} className='w-full'>
      <PlaceOrderButton />
    </form>
  );
};

export default PlaceOrderForm;
