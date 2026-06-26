
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Loader2, Info } from 'lucide-react';

export default function InvoicePreviewModal({ isOpen, onClose, bookingId, invoiceUrl }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!invoiceUrl) return;
    setIsDownloading(true);
    
    try {
      // Fetch the file to trigger an actual download instead of opening a new tab
      const response = await fetch(invoiceUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Invoice_${bookingId || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed, opening in new tab', error);
      window.open(invoiceUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col bg-gray-950 border-gray-800 p-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="p-4 border-b border-gray-900 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-white text-xl m-0 font-serif">Invoice Preview</DialogTitle>
            <span className="hidden sm:flex items-center text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-800">
              <Info className="w-3 h-3 mr-1" /> Scroll down to view the QR Code page
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="text-gray-400 hover:text-white hover:bg-gray-900 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>
        
        <div className="flex-1 w-full bg-gray-900 relative">
          {invoiceUrl ? (
            <iframe
              src={`${invoiceUrl}#toolbar=0&view=FitH`}
              className="w-full h-full absolute inset-0 border-0"
              title="Invoice and QR Code Preview"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-gray-600" />
              <p>Preparing document...</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-gray-900 bg-gray-950 flex sm:justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900"
          >
            Close & Proceed
          </Button>
          <Button 
            onClick={handleDownload} 
            disabled={isDownloading || !invoiceUrl} 
            className="bg-green-500 hover:bg-green-600 text-black font-semibold"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download Merged PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
