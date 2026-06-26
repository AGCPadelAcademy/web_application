
import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const InvoiceModal = ({ open, onOpenChange, invoiceUrl, invoiceName }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col bg-gray-900 border-gray-700 text-white rounded-2xl p-0 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900">
            <DialogHeader className="m-0 space-y-0">
                <DialogTitle className="flex items-center gap-2 text-xl text-green-400 m-0">
                    <FileText className="w-6 h-6" />
                    Invoice Generated Successfully
                </DialogTitle>
                <DialogDescription className="sr-only">View and download your invoice</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    className="border-gray-600 hover:bg-gray-800 text-white"
                    onClick={() => {
                        const link = document.createElement('a');
                        link.href = invoiceUrl;
                        link.download = `${invoiceName || 'invoice'}.pdf`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                    <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </Button>
            </div>
        </div>
        
        <div className="flex-1 bg-gray-800 p-4">
            {invoiceUrl ? (
                <iframe 
                    src={invoiceUrl} 
                    className="w-full h-full rounded-lg border border-gray-700 bg-white"
                    title="Invoice PDF"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Loading PDF...
                </div>
            )}
        </div>
        
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
            <Button onClick={() => onOpenChange(false)} className="bg-green-500 hover:bg-green-600 text-black font-bold">
                Back to Lessons
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModal;
