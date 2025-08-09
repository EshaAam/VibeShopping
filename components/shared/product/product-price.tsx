import { cn } from '@/lib/utils';
//for type error in product-price.tsx
interface ProductPriceProps {
  // It will likely come as a string due to Prisma Decimal mapping
  // It could also be null/undefined if you changed the schema to allow it (e.g., price Decimal?)
  value: string | number | null | undefined;
  className?: string;
}
const ProductPrice: React.FC<ProductPriceProps> = ({ value, className }) => {
  let numericValue: number;

  if (typeof value === 'string') {
    numericValue = parseFloat(value);
  } else if (typeof value === 'number') {
    // This case would happen if you explicitly converted it to a number earlier
    numericValue = value;
  } else {
    // Handle null or undefined price
    return <p className={cn('text-2xl', className)}>N/A</p>;
  }

  if (isNaN(numericValue)) {
    // Handle cases where parsing fails (e.g., value was "not-a-number")
    return <p className={cn('text-2xl', className)}>Invalid Price</p>;
  }

    // Now numericValue is guaranteed to be a number (or NaN, which we handle)
  const stringValue = numericValue.toFixed(2); // This will now work!
  const [intValue, floatValue] = stringValue.split('.');

// const ProductPrice = ({
//   value,
//   className,
// }: {
//   value: number;
//   className?: string;
// }) => {
//   // Ensures two decimal places
//   const stringValue = value.toFixed(2); 
//   // Split into integer and decimal parts
//   const [intValue, floatValue] = stringValue.split('.'); 

  return (
    <p className={cn('text-2xl', className)}>
      <span className='text-xs align-super'>$</span>
      {intValue}
      <span className='text-xs align-super'>.{floatValue}</span>
    </p>
  );
};

export default ProductPrice;