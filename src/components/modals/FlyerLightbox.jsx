import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

/**
 * Larger view for a Camp flyer. Radix Dialog provides Escape dismissal,
 * focus trapping, and overlay click-out, matching InvoicePreviewModal
 * conventions. Triggers must be type="button" so enclosing forms (camp
 * edit form, registration flow) never submit and page state is preserved.
 */
export default function FlyerLightbox({ open, onClose, imageUrl, title }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-3xl w-[95vw] bg-gray-950 border-gray-800 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-gray-900 flex flex-row items-center justify-between">
          <DialogTitle className="text-white text-lg m-0 font-serif">
            {title ? `${title} — flyer` : 'Camp flyer'}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close flyer view"
            className="text-gray-400 hover:text-white hover:bg-gray-900 rounded-full"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title ? `${title} flyer` : 'Camp flyer'}
              className="max-w-full max-h-[72vh] object-contain rounded-lg"
            />
          ) : (
            <p className="text-gray-500 py-16">The flyer could not be loaded.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
