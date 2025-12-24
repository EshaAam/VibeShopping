'use client';

import { useEffect, useState } from 'react';
import { Review } from '@/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import ReviewForm from './review-form';
import { getReviews } from '@/lib/actions/review.actions';
import Rating from '@/components/shared/product/rating';

const ReviewList = ({
  userId,
  productId,
  productSlug,
}: {
  userId: string;
  productId: string;
  productSlug: string;
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    /// Load reviews from the database
    const loadReviews = async () => {
      const res = await getReviews({ productId });
      setReviews(res.data);
    };

    loadReviews();
  }, [productId]);

  // Reload reviews when a review is submitted
  const reload = async () => {
    try {
      const res = await getReviews({ productId });
      setReviews([...res.data]);
    } catch (err) {
      console.log(err);
      toast({
        variant: 'destructive',
        description: 'Error in fetching reviews',
      });
    }
  };

  return (
    <div className='space-y-4'>
      {reviews.length === 0 && <div>No reviews yet</div>}
      {userId ? (
        <ReviewForm userId={userId} productId={productId} onReviewSubmitted={reload} />
      ) : (
        <div>
          Please{' '}
          <Link
            className='text-primary px-2'
            href={`/api/auth/signin?callbackUrl=/product/${productSlug}`}
          >
            sign in
          </Link>{' '}
          to write a review
        </div>
      )}
      <div className='flex flex-col gap-3'>
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className='flex items-center gap-2'>
                <User className='h-4 w-4' />
                <CardTitle>{review.title}</CardTitle>
              </div>
              <div className='flex items-center gap-2'>
                <Rating value={review.rating} />
                <span className='text-sm text-muted-foreground'>
                  {formatDateTime(review.createdAt).dateTime}
                </span>
              </div>
              <CardDescription className='mt-2'>{review.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ReviewList;
