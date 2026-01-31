import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Headset, ShoppingBag, WalletCards } from 'lucide-react';

const IconBoxes = () => {
  return (
    <div className='my-6 sm:my-8'>
      <Card>
        <CardContent className='grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 p-4 sm:p-6'>
          <div className='space-y-2 text-center sm:text-left'>
            <ShoppingBag className='h-6 w-6 mx-auto sm:mx-0 text-primary' />
            <div className='text-xs sm:text-sm font-bold'>Free Shipping</div>
            <div className='text-[10px] sm:text-sm text-muted-foreground'>
              Free shipping for order above $100
            </div>
          </div>
          <div className='space-y-2 text-center sm:text-left'>
            <DollarSign className='h-6 w-6 mx-auto sm:mx-0 text-primary' />
            <div className='text-xs sm:text-sm font-bold'>Money Back Guarantee</div>
            <div className='text-[10px] sm:text-sm text-muted-foreground'>
              Within 30 days for an exchange
            </div>
          </div>
          <div className='space-y-2 text-center sm:text-left'>
            <WalletCards className='h-6 w-6 mx-auto sm:mx-0 text-primary' />
            <div className='text-xs sm:text-sm font-bold'>Flexible Payment</div>
            <div className='text-[10px] sm:text-sm text-muted-foreground'>
              Pay with credit card, PayPal or COD
            </div>
          </div>
          <div className='space-y-2 text-center sm:text-left'>
            <Headset className='h-6 w-6 mx-auto sm:mx-0 text-primary' />
            <div className='text-xs sm:text-sm font-bold'>24/7 Support</div>
            <div className='text-[10px] sm:text-sm text-muted-foreground'>
              Get support at any time!
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
export default IconBoxes;
