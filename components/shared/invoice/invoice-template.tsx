'use client';

import { Order } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import Image from 'next/image';
import { forwardRef } from 'react';

interface InvoiceTemplateProps {
  order: Order;
}

const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ order }, ref) => {
    const {
      id,
      createdAt,
      shippingAddress,
      orderItems,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      paymentMethod,
      isPaid,
      paidAt,
      user,
    } = order;

    // Generate invoice number from order id
    const invoiceNumber = id.substring(id.length - 5).toUpperCase();

    // Calculate tax percentage
    const taxPercentage = Number(itemsPrice) > 0 
      ? Math.round((Number(taxPrice) / Number(itemsPrice)) * 100) 
      : 0;

    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 max-w-2xl mx-auto"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b-4 border-black pb-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="VibeShopping"
              width={50}
              height={50}
              className="object-contain"
            />
            <h1 className="text-4xl font-serif tracking-wider">VibeShopping</h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Invoice No. {invoiceNumber}</p>
            <p>{formatDateTime(createdAt).dateOnly}</p>
          </div>
        </div>

        {/* Billed To */}
        <div className="mb-8">
          <h2 className="font-bold text-sm mb-2">Billed to:</h2>
          <p className="font-semibold">{shippingAddress.fullName}</p>
          <p className="text-sm text-gray-600">{user?.email || ''}</p>
          <p className="text-sm">{shippingAddress.streetAddress}</p>
          <p className="text-sm">
            {shippingAddress.city}, {shippingAddress.postalCode}
          </p>
          <p className="text-sm">{shippingAddress.country}</p>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-cyan-100">
                <th className="text-left py-3 px-4 rounded-l-lg">Item</th>
                <th className="text-center py-3 px-4">Quantity</th>
                <th className="text-center py-3 px-4">Unit Price</th>
                <th className="text-left py-3 px-4 rounded-r-lg">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-4 px-4">{item.name}</td>
                  <td className="text-center py-4 px-4">{item.qty}</td>
                  <td className="text-center py-4 px-4">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="text-left py-4 px-4">
                    {formatCurrency(Number(item.price) * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="mt-4 flex flex-col items-end pr-6">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="font-semibold text-left">Subtotal</span>
                <span className='text-left'>{formatCurrency(itemsPrice)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="font-semibold text-left">Shipping</span>
                <span className="text-left">{formatCurrency(shippingPrice)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="font-semibold text-left">Tax ({taxPercentage}%)</span>
                <span className="text-left">{formatCurrency(taxPrice)}</span>
              </div>
              <div className="flex justify-between py-3 text-left bg-purple-100 px-2 mt-2 rounded">
                <span className="font-bold text-left text-lg">Total</span>
                <span className="font-bold text-left text-lg text-purple-700">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="mb-8 pt-4 border-t border-gray-300">
          <h2 className="font-bold text-sm mb-2">Payment Information</h2>
          <p className="text-sm">Payment Method: {paymentMethod}</p>
          <p className="text-sm">
            Status: {isPaid ? `Paid on ${formatDateTime(paidAt!).dateOnly}` : 'Pending'}
          </p>
          <p className="text-sm">Order ID: {id}</p>
        </div>

        {/* Thank You */}
        <div className="text-center mt-12 mb-4">
          <p className="text-3xl font-serif italic">Thank You</p>
          <p className="text-sm text-gray-500 mt-2">
            For shopping with VibeShopping
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
          <p>VibeShopping • Your favorite online store</p>
          <p>This is a computer-generated invoice. No signature required.</p>
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;
