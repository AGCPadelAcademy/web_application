import { addMinutes, format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { isBexioBillingEnabled, issueBexioInvoice } from '@/lib/billing';

// Payment statuses that reserve a slot on the availability grid.
export const ACTIVE_BOOKING_STATUSES = ['confirmed', 'pending'];

export async function fetchDayBookings(bookingDate) {
  // Reads the non-PII booking_slots view (RLS-safe for anonymous visitors).
  const { data, error } = await supabase
    .from('booking_slots')
    .select('booking_date, start_time, end_time, payment_status')
    .eq('booking_date', bookingDate)
    .in('payment_status', ACTIVE_BOOKING_STATUSES);

  if (error) throw error;
  return data ?? [];
}

export function buildBookingPayload({ userId, lesson, bookingDate, selectedTime, profile, comments }) {
  return {
    user_id: userId,
    lesson_code: lesson.lesson_code,
    lesson_name: lesson.name,
    price: `${lesson.price_amount} CHF`,
    booking_date: bookingDate,
    start_time: selectedTime ? selectedTime.time : null,
    end_time: selectedTime ? format(addMinutes(selectedTime.date, lesson.duration_minutes), 'HH:mm') : null,
    duration_minutes: lesson.duration_minutes,
    status: 'pending_payment',
    payment_status: 'pending',
    client_email: profile.email,
    client_phone: profile.phone,
    notes: comments,
  };
}

export async function createBooking(payload) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// The Edge Function allocates the invoice number atomically (INV-YYYY/MM/DD-XX)
// and returns the public PDF URL.
// Cutover branch (research R-12): when the Bexio integration is connected, new
// bookings are invoiced in Bexio instead. There is no automatic fallback to the
// legacy generator on Bexio failure (Q1-A) — the function enqueues a retry and
// the error surfaces to the caller. The Bexio path returns no `url`: the PDF is
// served on demand by billing-invoice-document (US3).
export async function requestInvoice({ booking, lesson, profile, userId }) {
  if (await isBexioBillingEnabled()) {
    const data = await issueBexioInvoice(booking.id);
    return {
      success: true,
      url: null,
      invoice_id: null,
      document: data.document,
      reused: data.reused,
    };
  }

  // The function runs with verify_jwt: true — attach the session token
  // explicitly; functions.invoke does not reliably refresh its captured
  // Authorization header when sign-in happens after client construction.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to generate an invoice.');
  }

  const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      booking_id: booking.id,
      amount: lesson.price_amount,
      invoice_date: booking.booking_date,
      customer_fullname: profile.full_name,
      customer_address: profile.address,
      customer_postal_city: `${profile.postal_code} ${profile.city}`,
      customer_country: profile.country,
      lesson_name: booking.lesson_name,
      qty: 1,
      user_id: userId,
    },
  });

  if (error || !data?.success) {
    // FunctionsHttpError carries the raw Response on .context — surface the
    // function's (or gateway's) real message instead of the generic
    // "Edge function returned a non-2xx status code".
    let detail = error?.message;
    const response = error?.context;
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json();
        detail = body?.error || body?.message || detail;
      } catch { /* body already consumed or not JSON */ }
    }
    throw new Error(detail || data?.error || 'Invoice generation failed');
  }
  return data;
}
