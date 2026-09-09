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

export default function RemoveChildModal({
  open,
  child,
  loading,
  onClose,
  onConfirm,
}) {
  const name = child ? `${child.first_name} ${child.last_name}`.trim() : 'this child';

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
          <DialogTitle className="text-red-400 text-2xl">Remove {child?.first_name || 'child'}?</DialogTitle>
          <DialogDescription className="text-gray-400">
            This permanently removes the child and cannot be undone. Children with camp
            registrations or invoices cannot be removed — their history is kept.
          </DialogDescription>
        </DialogHeader>

        {child && (
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <p className="font-semibold text-lg text-white">{name}</p>
            <p className="text-sm text-gray-300">
              {[child.date_of_birth, child.padel_level].filter(Boolean).join(' · ')}
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
            Keep child
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
                Removing…
              </>
            ) : (
              'Remove child'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
