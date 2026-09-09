import { fetchCampInvoicePdfBlob, fetchInvoicePdfBlob } from '@/lib/billing';

export function invoicePreviewDownloadName({ bookingId, campRegistrationId } = {}) {
  if (campRegistrationId) return `Invoice_${campRegistrationId}.pdf`;
  if (bookingId) return `Invoice_${bookingId}.pdf`;
  return 'Invoice_receipt.pdf';
}

export async function loadInvoicePreviewBlob({ invoiceUrl, bookingId, campRegistrationId } = {}) {
  if (invoiceUrl) {
    return { previewUrl: invoiceUrl, ownedBlob: false };
  }
  if (campRegistrationId) {
    const previewUrl = await fetchCampInvoicePdfBlob(campRegistrationId);
    return { previewUrl, ownedBlob: true };
  }
  if (bookingId) {
    const previewUrl = await fetchInvoicePdfBlob(bookingId);
    return { previewUrl, ownedBlob: true };
  }
  throw new Error('Invoice is not available yet.');
}
