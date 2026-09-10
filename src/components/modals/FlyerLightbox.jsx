import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Image-only Camp flyer preview (C6 T123). Blurred overlay, no invoice-style
 * dialog chrome/title. Close sits on the image; overlay click and Escape
 * still dismiss without submitting enclosing forms.
 */
export default function FlyerLightbox({ open, onClose, imageUrl, title }) {
  const label = title ? `${title} flyer` : 'Camp flyer';
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-md" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 p-0 border-0 bg-transparent shadow-none outline-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <div className="relative inline-block max-w-[95vw]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={label}
                className="max-w-[95vw] max-h-[90vh] object-contain"
              />
            ) : (
              <p className="text-gray-200 py-16 px-8">The flyer could not be loaded.</p>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close flyer view"
              className="absolute top-2 right-2 z-10 rounded-full bg-black/60 text-white p-1.5 hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
