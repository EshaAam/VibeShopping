'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import {
  Package,
  Heart,
  MapPin,
  Clock,
  Edit,
  User,
  Mail,
  Calendar,
  Shield,
  CreditCard,
  CheckCircle,
  Loader,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import GradientHoverCard from '@/components/ui/gradient-hover-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { updateProfile, updateUserAddress, updateUserPaymentMethod } from '@/lib/actions/user.actions';
import { updateProfileSchema, shippingAddressSchema, paymentMethodSchema } from '@/lib/validator';
import { formatDateTime } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/constants';

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  createdAt: Date;
  address: {
    fullName?: string;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  } | null;
  paymentMethod: string | null;
  totalOrders: number;
  activeOrders: number;
  wishlistItems: number;
  providers: string[];
}

const ProfileDashboard = ({ user }: { user: UserData }) => {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Profile Form
  const profileForm = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
    },
  });

  const onProfileSubmit = async (values: z.infer<typeof updateProfileSchema>) => {
    const res = await updateProfile(values);

    if (!res.success) {
      return toast({
        variant: 'destructive',
        description: res.message,
      });
    }

    const newSession = {
      ...session,
      user: {
        ...session?.user,
        name: values.name,
      },
    };

    await update(newSession);
    toast({ description: res.message });
  };

  // Address Form
  const addressForm = useForm<z.infer<typeof shippingAddressSchema>>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      fullName: user.address?.fullName || user.name,
      streetAddress: user.address?.streetAddress || '',
      city: user.address?.city || '',
      postalCode: user.address?.postalCode || '',
      country: user.address?.country || '',
    },
  });

  const onAddressSubmit = async (values: z.infer<typeof shippingAddressSchema>) => {
    const res = await updateUserAddress(values);

    toast({
      variant: res.success ? 'default' : 'destructive',
      description: res.message,
    });
  };

  // Payment Form
  const paymentForm = useForm<z.infer<typeof paymentMethodSchema>>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      type: user.paymentMethod || 'PayPal',
    },
  });

  const onPaymentSubmit = async (values: z.infer<typeof paymentMethodSchema>) => {
    const res = await updateUserPaymentMethod(values);

    toast({
      variant: res.success ? 'default' : 'destructive',
      description: res.message,
    });
  };

  return (
    <div className='space-y-6'>
      {/* Profile Header */}
      <GradientHoverCard>
        <div className='flex flex-col md:flex-row items-start md:items-center gap-6'>
          {/* Avatar */}
          <div className='relative'>
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name}
                width={96}
                height={96}
                className='rounded-full object-cover'
              />
            ) : (
              <div className='w-24 h-24 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-700 text-2xl font-bold border border-gray-200/50 shadow-sm'>
                {getInitials(user.name)}
              </div>
            )}
            {user.providers.length > 0 && (
              <div className='absolute -bottom-1 -right-1 bg-white/90 rounded-full p-1 border border-white/50'>
                <CheckCircle className='h-5 w-5 text-green-600' />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className='flex-1 space-y-2'>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-800'>{user.name}</h1>
              <Badge variant='secondary' className='capitalize bg-gray-800 text-white border-0'>
                {user.role}
              </Badge>
            </div>
            <div className='flex flex-wrap items-center gap-4 text-gray-600 text-sm'>
              <span className='flex items-center gap-1'>
                <Mail className='h-4 w-4' />
                {user.email}
              </span>
              <span className='flex items-center gap-1'>
                <Calendar className='h-4 w-4' />
                Member since {formatDateTime(user.createdAt).dateOnly}
              </span>
            </div>
            {user.providers.length > 0 && (
              <div className='flex items-center gap-2'>
                <span className='text-xs text-gray-500'>Connected via:</span>
                {user.providers.map((provider) => (
                  <Badge key={provider} variant='outline' className='text-xs capitalize bg-white/60 text-gray-700 border-gray-300/50'>
                    {provider}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Edit Button */}
          <Button
            variant='outline'
            size='sm'
            onClick={() => setActiveTab('profile')}
            className='bg-white/80 hover:bg-white text-gray-700 border-gray-300/50 shadow-sm'
          >
            <Edit className='h-4 w-4 mr-2' />
            Edit Profile
          </Button>
        </div>
      </GradientHoverCard>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <GradientHoverCard>
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-full bg-white/60 backdrop-blur-sm shadow-sm'>
              <Package className='h-6 w-6 text-gray-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-gray-800'>{user.totalOrders}</p>
              <p className='text-sm text-gray-500'>Total Orders</p>
            </div>
          </div>
        </GradientHoverCard>

        <GradientHoverCard>
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-full bg-white/60 backdrop-blur-sm shadow-sm'>
              <Clock className='h-6 w-6 text-gray-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-gray-800'>{user.activeOrders}</p>
              <p className='text-sm text-gray-500'>Active Orders</p>
            </div>
          </div>
        </GradientHoverCard>

        <GradientHoverCard>
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-full bg-white/60 backdrop-blur-sm shadow-sm'>
              <Heart className='h-6 w-6 text-gray-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-gray-800'>{user.wishlistItems}</p>
              <p className='text-sm text-gray-500'>Wishlist Items</p>
            </div>
          </div>
        </GradientHoverCard>

        <GradientHoverCard>
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-full bg-white/60 backdrop-blur-sm shadow-sm'>
              <MapPin className='h-6 w-6 text-gray-600' />
            </div>
            <div>
              <p className='text-2xl font-bold text-gray-800'>{user.address ? 1 : 0}</p>
              <p className='text-sm text-gray-500'>Saved Addresses</p>
            </div>
          </div>
        </GradientHoverCard>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-4'>
        <GradientHoverCard>
          <div className='grid w-full grid-cols-4 gap-2'>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'profile'
                  ? 'bg-white/80 text-gray-800 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-white/40'
              }`}
            >
              <User className='h-4 w-4' />
              <span className='hidden sm:inline'>Profile Info</span>
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'addresses'
                  ? 'bg-white/80 text-gray-800 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-white/40'
              }`}
            >
              <MapPin className='h-4 w-4' />
              <span className='hidden sm:inline'>Addresses</span>
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'payment'
                  ? 'bg-white/80 text-gray-800 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-white/40'
              }`}
            >
              <CreditCard className='h-4 w-4' />
              <span className='hidden sm:inline'>Payment</span>
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'security'
                  ? 'bg-white/80 text-gray-800 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-white/40'
              }`}
            >
              <Shield className='h-4 w-4' />
              <span className='hidden sm:inline'>Security</span>
            </button>
          </div>
        </GradientHoverCard>

        {/* Profile Info Tab */}
        <TabsContent value='profile'>
          <GradientHoverCard>
            <div className='space-y-4'>
              <div>
                <h3 className='text-lg font-bold text-gray-800'>Profile Information</h3>
                <p className='text-sm text-gray-500'>Update your personal details here.</p>
              </div>
              <Form {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                  className='space-y-4 max-w-md'
                >
                  <FormField
                    control={profileForm.control}
                    name='name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder='John Doe' {...field} className='bg-white/70 border-gray-200/50' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name='email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='john@example.com'
                            {...field}
                            disabled={user.providers.length > 0}
                            className='bg-white/70 border-gray-200/50'
                          />
                        </FormControl>
                        {user.providers.length > 0 && (
                          <p className='text-xs text-gray-500'>
                            Email cannot be changed for OAuth accounts
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='flex gap-3'>
                    <Button
                      type='submit'
                      disabled={profileForm.formState.isSubmitting}
                      className='bg-gray-800 hover:bg-gray-900 text-white'
                    >
                      {profileForm.formState.isSubmitting ? (
                        <Loader className='h-4 w-4 animate-spin mr-2' />
                      ) : null}
                      Save Changes
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => profileForm.reset()}
                      className='bg-white/70 hover:bg-white text-gray-700 border-gray-200/50'
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </GradientHoverCard>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value='addresses'>
          <GradientHoverCard>
            <div className='space-y-4'>
              <div>
                <h3 className='text-lg font-bold text-gray-800'>Shipping Address</h3>
                <p className='text-sm text-gray-500'>Manage your shipping addresses for faster checkout.</p>
              </div>
              {user.address && (
                <div className='mb-4 p-4 border border-gray-200/50 rounded-lg bg-white/50'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <div className='flex items-center gap-2 mb-2'>
                        <Badge variant='secondary' className='bg-gray-800 text-white'>Default</Badge>
                      </div>
                      <p className='font-medium text-gray-800'>{user.address.fullName}</p>
                      <p className='text-sm text-gray-600'>{user.address.streetAddress}</p>
                      <p className='text-sm text-gray-600'>{user.address.city}, {user.address.postalCode}</p>
                      <p className='text-sm text-gray-600'>{user.address.country}</p>
                    </div>
                  </div>
                </div>
              )}

              <Form {...addressForm}>
                <form
                  onSubmit={addressForm.handleSubmit(onAddressSubmit)}
                  className='space-y-4 max-w-md'
                >
                  <FormField
                    control={addressForm.control}
                    name='fullName'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} className='bg-white/70 border-gray-200/50' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addressForm.control}
                    name='streetAddress'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} className='bg-white/70 border-gray-200/50' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={addressForm.control}
                      name='city'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-gray-700'>City</FormLabel>
                          <FormControl>
                            <Input {...field} className='bg-white/70 border-gray-200/50' />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addressForm.control}
                      name='postalCode'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-gray-700'>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} className='bg-white/70 border-gray-200/50' />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addressForm.control}
                    name='country'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Country</FormLabel>
                        <FormControl>
                          <Input {...field} className='bg-white/70 border-gray-200/50' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='flex gap-3'>
                    <Button
                      type='submit'
                      disabled={addressForm.formState.isSubmitting}
                      className='bg-gray-800 hover:bg-gray-900 text-white'
                    >
                      {addressForm.formState.isSubmitting ? (
                        <Loader className='h-4 w-4 animate-spin mr-2' />
                      ) : null}
                      {user.address ? 'Update Address' : 'Add Address'}
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => addressForm.reset()}
                      className='bg-white/70 hover:bg-white text-gray-700 border-gray-200/50'
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </GradientHoverCard>
        </TabsContent>

        {/* Payment Preferences Tab */}
        <TabsContent value='payment'>
          <GradientHoverCard>
            <div className='space-y-4'>
              <div>
                <h3 className='text-lg font-bold text-gray-800'>Payment Preferences</h3>
                <p className='text-sm text-gray-500'>Set your preferred payment method for faster checkout.</p>
              </div>
              {user.paymentMethod && (
                <div className='mb-4 p-4 border border-gray-200/50 rounded-lg bg-white/50'>
                  <div className='flex items-center gap-2'>
                    <CreditCard className='h-5 w-5 text-gray-600' />
                    <span className='font-medium text-gray-700'>Current Method:</span>
                    <Badge variant='secondary' className='bg-gray-800 text-white'>{user.paymentMethod}</Badge>
                  </div>
                </div>
              )}

              <Form {...paymentForm}>
                <form
                  onSubmit={paymentForm.handleSubmit(onPaymentSubmit)}
                  className='space-y-4 max-w-md'
                >
                  <FormField
                    control={paymentForm.control}
                    name='type'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-gray-700'>Payment Method</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className='space-y-3'
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <div
                                key={method}
                                className='flex items-center space-x-3 border border-gray-200/50 rounded-lg p-4 cursor-pointer bg-white/50 hover:bg-white/80'
                              >
                                <RadioGroupItem value={method} id={method} />
                                <label
                                  htmlFor={method}
                                  className='flex-1 cursor-pointer font-medium text-gray-700'
                                >
                                  {method}
                                </label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className='flex gap-3'>
                    <Button
                      type='submit'
                      disabled={paymentForm.formState.isSubmitting}
                      className='bg-gray-800 hover:bg-gray-900 text-white'
                    >
                      {paymentForm.formState.isSubmitting ? (
                        <Loader className='h-4 w-4 animate-spin mr-2' />
                      ) : null}
                      Save Preference
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => paymentForm.reset()}
                      className='bg-white/70 hover:bg-white text-gray-700 border-gray-200/50'
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </GradientHoverCard>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value='security'>
          <GradientHoverCard>
            <div className='space-y-6'>
              <div>
                <h3 className='text-lg font-bold text-gray-800'>Security Settings</h3>
                <p className='text-sm text-gray-500'>Manage your account security and connected providers.</p>
              </div>
              
              {/* Connected Accounts */}
              <div>
                <h4 className='text-md font-semibold text-gray-700 mb-4'>Connected Accounts</h4>
                {user.providers.length > 0 ? (
                  <div className='space-y-3'>
                    {user.providers.map((provider) => (
                      <div
                        key={provider}
                        className='flex items-center justify-between p-4 border border-gray-200/50 rounded-lg bg-white/50'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='p-2 rounded-full bg-white/80 shadow-sm'>
                            <Shield className='h-5 w-5 text-gray-600' />
                          </div>
                          <div>
                            <p className='font-medium capitalize text-gray-800'>{provider}</p>
                            <p className='text-sm text-gray-500'>Connected via OAuth</p>
                          </div>
                        </div>
                        <Badge variant='outline' className='text-green-700 border-green-500 bg-green-100'>
                          Connected
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='p-4 border border-gray-200/50 rounded-lg bg-white/50'>
                    <p className='text-sm text-gray-600'>
                      You are using email/password authentication.
                    </p>
                  </div>
                )}
              </div>

              {/* Change Password Section */}
              {user.providers.length === 0 && (
                <div>
                  <h4 className='text-md font-semibold text-gray-700 mb-4'>Change Password</h4>
                  <div className='space-y-4 max-w-md'>
                    <div>
                      <label className='text-sm font-medium text-gray-700'>Current Password</label>
                      <Input type='password' className='mt-1 bg-white/70 border-gray-200/50' />
                    </div>
                    <div>
                      <label className='text-sm font-medium text-gray-700'>New Password</label>
                      <Input type='password' className='mt-1 bg-white/70 border-gray-200/50' />
                    </div>
                    <div>
                      <label className='text-sm font-medium text-gray-700'>Confirm New Password</label>
                      <Input type='password' className='mt-1 bg-white/70 border-gray-200/50' />
                    </div>
                    <Button className='bg-gray-800 hover:bg-gray-900 text-white'>Update Password</Button>
                  </div>
                </div>
              )}

              {/* Account Actions */}
              <div>
                <h4 className='text-md font-semibold text-gray-700 mb-4'>Account Actions</h4>
                <div className='space-y-3'>
                  <Button variant='outline' className='w-full sm:w-auto bg-white/70 hover:bg-white text-gray-700 border-gray-200/50'>
                    Log out from all devices
                  </Button>
                </div>
              </div>
            </div>
          </GradientHoverCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileDashboard;