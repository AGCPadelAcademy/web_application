import { format } from 'date-fns';

export function documentOf(record) {
  const docs = record?.billing_documents;
  if (!docs) return null;
  return Array.isArray(docs) ? docs[0] : docs;
}

export function paymentInvoiceState(record) {
  const doc = documentOf(record);
  if (record?.payment_status === 'cancelled' || record?.status === 'cancelled' || doc?.status === 'cancelled') {
    return 'cancelled';
  }
  if (record?.payment_status === 'confirmed' || doc?.status === 'paid') {
    return 'paid';
  }
  return 'pending';
}

export function asLessonPaymentItem(booking) {
  return { kind: 'lesson', id: booking.id, createdAt: booking.created_at, booking };
}

export function asCampPaymentItem(registration) {
  return { kind: 'camp', id: registration.id, createdAt: registration.created_at, registration };
}

export function mergePaymentItems(bookings = [], campRegistrations = []) {
  return [
    ...bookings.map(asLessonPaymentItem),
    ...campRegistrations.map(asCampPaymentItem),
  ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function campPaymentTitle(registration) {
  const child = [registration?.child_first_name, registration?.child_last_name].filter(Boolean).join(' ');
  if (child && registration?.camp_name) return `${registration.camp_name} · ${child}`;
  return registration?.camp_name || 'Camp registration';
}

/** Card date is created_at (invoice/booking created). Do not use nullable booking_date. */
export function paymentCardDate(record) {
  if (!record?.created_at) return 'N/A';
  const date = new Date(record.created_at);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return format(date, 'dd MMM yyyy');
}
