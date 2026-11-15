import { useEffect, useRef, useState } from 'react';
import { invoicePreviewDownloadName, loadInvoicePreviewBlob } from '@/lib/invoicePreview';
import NewDialog from './NewDialog';

const NewInvoiceDialog = ({ open, onClose, bookingId = null, campRegistrationId = null, invoiceUrl = null }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ownedRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setError('');
      setLoading(false);
      if (ownedRef.current) {
        URL.revokeObjectURL(ownedRef.current);
        ownedRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setPreviewUrl(null);
    (async () => {
      try {
        const loaded = await loadInvoicePreviewBlob({ invoiceUrl, bookingId, campRegistrationId });
        if (cancelled) {
          if (loaded.ownedBlob) URL.revokeObjectURL(loaded.previewUrl);
          return;
        }
        if (loaded.ownedBlob) ownedRef.current = loaded.previewUrl;
        setPreviewUrl(loaded.previewUrl);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the invoice PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, invoiceUrl, bookingId, campRegistrationId]);

  const download = async () => {
    if (!previewUrl) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = invoicePreviewDownloadName({ bookingId, campRegistrationId });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <NewDialog open={open} title="Invoice" onClose={onClose}>
      <p className="nf-lead">Scroll the invoice to the QR page to pay by bank transfer.</p>
      {loading && <p>Loading the invoice…</p>}
      {error && <p className="nf-error">{error}</p>}
      {previewUrl && <iframe title="Invoice preview" src={previewUrl} className="nf-invoice-frame" />}
      <div className="nf-row">
        <button type="button" className="nf-pill is-quiet" onClick={onClose}>Close</button>
        <button type="button" className="nf-pill border-0" onClick={download} disabled={!previewUrl}>Download</button>
      </div>
    </NewDialog>
  );
};

export default NewInvoiceDialog;
