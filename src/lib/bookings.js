import { addMinutes, format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';

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
export async function requestInvoice({ booking, lesson, profile, userId }) {
  const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
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
    throw new Error(error?.message || data?.error || 'Invoice generation failed');
  }
  return data;
}
