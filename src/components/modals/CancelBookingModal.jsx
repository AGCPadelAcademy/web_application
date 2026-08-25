import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CancelBookingModal({
  open,
  booking,
  loading,
  onClose,
  onConfirm,
}) {
  const lessonName = booking?.lesson_name || 'this booking';
  const dateLabel = booking?.booking_date
    ? format(new Date(booking.booking_date), 'dd MMM yyyy')
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onClose();
      }}
    >
      <DialogContent
        className="bg-gray-900 border-gray-700 text-white rounded-2xl max-w-lg shadow-lg"
        onInteractOutside={(event) => {
          if (loading) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (loading) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-green-400 text-2xl">Cancel unpaid booking?</DialogTitle>
          <DialogDescription className="text-gray-400">
            The unpaid invoice will be cancelled. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {booking && (
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-1">
            <p className="font-semibold text-lg text-white">{lessonName}</p>
            <p className="text-sm text-gray-300">
              {[dateLabel, booking.price].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="text-white border-gray-600 hover:bg-gray-800"
          >
            Keep booking
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling…
              </>
            ) : (
              'Cancel booking'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
