'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Order } from '@/types';
import InvoiceTemplate from './invoice-template';
import { Download, FileText, Loader } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceDialogProps {
  order: Order;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const InvoiceDialog = ({
  order,
  variant = 'outline',
  size = 'default',
  className = '',
}: InvoiceDialogProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;

    setIsGenerating(true);

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const imgX = (pageWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(
        imgData,
        'PNG',
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );

      const invoiceNumber = order.id.substring(order.id.length - 5).toUpperCase();
      pdf.save(`VibeShopping-Invoice-${invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <FileText className="w-4 h-4 mr-2" />
          Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
            <Button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="mr-8"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg overflow-hidden">
          <InvoiceTemplate ref={invoiceRef} order={order} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
