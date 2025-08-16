'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignInDefaultValues } from '@/lib/constants';
import Link from 'next/link';
import { signInWithCredentials } from '@/lib/actions/user.actions';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';

// User fills out the form in CredentialsSignInForm and submits it.
// Form submission triggers the signInWithCredentials server action via useActionState.
const CredentialsSignInForm = () => {

  const [data, action] = useActionState(signInWithCredentials,{
    success: false,
    message: ''
  });

  //This is how we get searchParams from a client component. We don't pass in props like the server component.
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';


  const SignInButton = () => {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} className='w-full' variant='default'>
      {pending ? 'Signing In...' : 'Sign In'}
    </Button>
  );
};
  return (
    <form action={action}>
      <input type='hidden' name='callbackUrl' value={callbackUrl} />
      <div className='space-y-6'>
        <div>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            name='email'
            required
            type='email'
            defaultValue={SignInDefaultValues.email}
            autoComplete='email'
          />
        </div>
        <div>
          <Label htmlFor='password'>Password</Label>
          <Input
            id='password'
            name='password'
            required
            type='password'
            defaultValue={SignInDefaultValues.password}
            autoComplete='current-password'
          />
        </div>
        <div>
          <SignInButton />
        </div>
        {data && !data.success && (
          <div className='text-center text-destructive'>{data.message}</div>
        )}
  

        <div className='text-sm text-center text-muted-foreground'>
          Don&apos;t have an account?{' '}
          <Link target='_self' className='link' href='/sign-up'>
            <b>Sign Up</b>
          </Link>
        </div>
      </div>
    </form>
  );
};
export default CredentialsSignInForm;