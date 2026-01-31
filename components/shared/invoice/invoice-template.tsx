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
        className="bg-white text-black p-4 sm:p-8 w-full max-w-2xl mx-auto"
        style={{ fontFamily: 'Arial, sans-serif', minWidth: '280px' }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 sm:mb-8 border-b-4 border-black pb-4 sm:pb-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="VibeShopping"
              width={40}
              height={40}
              className="object-contain"
            />
            <h1 className="text-2xl sm:text-4xl font-serif tracking-wider">VibeShopping</h1>
          </div>
          <div className="text-left sm:text-right text-xs sm:text-sm">
            <p className="font-semibold">Invoice No. {invoiceNumber}</p>
            <p>{formatDateTime(createdAt).dateOnly}</p>
          </div>
        </div>

        {/* Billed To */}
        <div className="mb-6 sm:mb-8">
          <h2 className="font-bold text-xs sm:text-sm mb-2">Billed to:</h2>
          <p className="font-semibold text-sm sm:text-base">{shippingAddress.fullName}</p>
          <p className="text-xs sm:text-sm text-gray-600 break-all">{user?.email || ''}</p>
          <p className="text-xs sm:text-sm">{shippingAddress.streetAddress}</p>
          <p className="text-xs sm:text-sm">
            {shippingAddress.city}, {shippingAddress.postalCode}
          </p>
          <p className="text-xs sm:text-sm">{shippingAddress.country}</p>
        </div>

        {/* Items Table - Mobile Card View */}
        <div className="mb-6 sm:mb-8">
          {/* Mobile View */}
          <div className="block sm:hidden space-y-3">
            {orderItems.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="font-medium text-sm mb-2 break-words">{item.name}</p>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Qty: {item.qty}</span>
                  <span>@ {formatCurrency(item.price)}</span>
                </div>
                <div className="flex justify-end mt-2 pt-2 border-t border-gray-200">
                  <span className="font-semibold text-sm">
                    {formatCurrency(Number(item.price) * item.qty)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop View */}
          <table className="hidden sm:table w-full">
            <thead>
              <tr className="bg-cyan-100">
                <th className="text-left py-3 px-3 rounded-l-lg text-sm">Item</th>
                <th className="text-center py-3 px-2 text-sm">Qty</th>
                <th className="text-center py-3 px-2 text-sm">Price</th>
                <th className="text-right py-3 px-3 rounded-r-lg text-sm">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-3 px-3 text-sm break-words max-w-[150px]">{item.name}</td>
                  <td className="text-center py-3 px-2 text-sm">{item.qty}</td>
                  <td className="text-center py-3 px-2 text-sm whitespace-nowrap">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="text-right py-3 px-3 text-sm whitespace-nowrap">
                    {formatCurrency(Number(item.price) * item.qty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="mt-4 flex flex-col items-end">
            <div className="w-full sm:w-64">
              <div className="flex justify-between py-2 border-b border-gray-200 text-sm">
                <span className="font-semibold">Subtotal</span>
                <span>{formatCurrency(itemsPrice)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 text-sm">
                <span className="font-semibold">Shipping</span>
                <span>{formatCurrency(shippingPrice)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 text-sm">
                <span className="font-semibold">Tax ({taxPercentage}%)</span>
                <span>{formatCurrency(taxPrice)}</span>
              </div>
              <div className="flex justify-between py-3 bg-purple-100 px-2 mt-2 rounded">
                <span className="font-bold text-base sm:text-lg">Total</span>
                <span className="font-bold text-base sm:text-lg text-purple-700">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="mb-6 sm:mb-8 pt-4 border-t border-gray-300">
          <h2 className="font-bold text-xs sm:text-sm mb-2">Payment Information</h2>
          <p className="text-xs sm:text-sm">Payment Method: {paymentMethod}</p>
          <p className="text-xs sm:text-sm">
            Status: {isPaid ? `Paid on ${formatDateTime(paidAt!).dateOnly}` : 'Pending'}
          </p>
          <p className="text-xs sm:text-sm break-all">Order ID: {id}</p>
        </div>

        {/* Thank You */}
        <div className="text-center mt-8 sm:mt-12 mb-4">
          <p className="text-2xl sm:text-3xl font-serif italic">Thank You</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            For shopping with VibeShopping
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] sm:text-xs text-gray-400 mt-6 sm:mt-8 pt-4 border-t">
          <p>VibeShopping • Your favorite online store</p>
          <p>This is a computer-generated invoice. No signature required.</p>
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';

export default InvoiceTemplate;
