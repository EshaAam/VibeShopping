'use client';

import { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createStripePaymentIntent, confirmStripePayment } from '@/lib/actions/payment.actions';
import { Loader, CheckCircle, XCircle, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// Load Stripe outside of component to avoid recreating on every render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface StripePaymentFormProps {
  orderId: string;
  totalPrice: number;
  onPaymentSuccess?: () => void;
}

// Inner form component that uses Stripe hooks
function CheckoutForm({ 
  orderId, 
  totalPrice, 
  onPaymentSuccess 
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Submit the payment form
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMessage(submitError.message || 'Payment submission failed');
        setIsProcessing(false);
        return;
      }

      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/${orderId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed');
        setPaymentStatus('error');
        toast({
          variant: 'destructive',
          description: error.message || 'Payment failed',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm on the server
        const result = await confirmStripePayment(orderId, paymentIntent.id);
        
        if (result.success) {
          setPaymentStatus('success');
          toast({
            description: '✅ Payment successful!',
          });
          onPaymentSuccess?.();
          // Refresh the page to show updated status
          router.refresh();
        } else {
          setErrorMessage(result.message || 'Failed to confirm payment');
          setPaymentStatus('error');
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred');
      setPaymentStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentStatus === 'success') {
    return (
      <div className='flex flex-col items-center justify-center py-6 space-y-3'>
        <CheckCircle className='w-12 h-12 text-green-500' />
        <h3 className='text-lg font-semibold text-green-600'>Payment Successful!</h3>
        <p className='text-sm text-muted-foreground'>Your order is being processed.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='text-lg font-semibold'>Stripe Checkout</div>
      
      <PaymentElement 
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
        }}
      />
      
      {errorMessage && (
        <div className='flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg'>
          <XCircle className='w-4 h-4 flex-shrink-0' />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        type='submit'
        disabled={!stripe || !elements || isProcessing}
        className='w-full bg-slate-900 hover:bg-slate-800 text-white'
        size='lg'
      >
        {isProcessing ? (
          <>
            <Loader className='w-4 h-4 mr-2 animate-spin' />
            Processing...
          </>
        ) : (
          <>Purchase {formatCurrency(totalPrice)}</>
        )}
      </Button>

      <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground'>
        <Lock className='w-3 h-3' />
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

// Main component that wraps with Stripe Elements
export default function StripePaymentForm({
  orderId,
  totalPrice,
  onPaymentSuccess,
}: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initPayment = async () => {
      try {
        const result = await createStripePaymentIntent(orderId);
        
        if (result.success && result.clientSecret) {
          setClientSecret(result.clientSecret);
        } else {
          setError(result.message || 'Failed to initialize payment');
        }
      } catch {
        setError('Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    };

    initPayment();
  }, [orderId]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='flex flex-col items-center gap-3'>
          <Loader className='w-6 h-6 animate-spin text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>Initializing payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='py-6'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <XCircle className='w-10 h-10 text-red-500' />
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0f172a',
            colorBackground: '#ffffff',
            colorText: '#1e293b',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '8px',
            spacingUnit: '4px',
          },
          rules: {
            '.Tab': {
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
            },
            '.Tab:hover': {
              border: '1px solid #94a3b8',
            },
            '.Tab--selected': {
              border: '2px solid #3b82f6',
              backgroundColor: '#eff6ff',
            },
            '.Input': {
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid #3b82f6',
              boxShadow: '0 0 0 1px #3b82f6',
            },
            '.Label': {
              fontWeight: '500',
              fontSize: '14px',
            },
          },
        },
      }}
    >
      <CheckoutForm
        orderId={orderId}
        totalPrice={totalPrice}
        onPaymentSuccess={onPaymentSuccess}
      />
    </Elements>
  );
}
