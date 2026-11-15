import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { requestInvoice, cancelBooking } from '@/lib/bookings';
import { cancelCampRegistration, listParentCampRegistrations } from '@/lib/camps';
import { fetchProfile } from '@/lib/profileService';
import {
  campPaymentTitle,
  documentOf,
  mergePaymentItems,
  paymentCardDate,
  paymentInvoiceState,
} from '@/lib/payments';
import MembershipCollectionSection from '@/components/payments/MembershipCollectionSection.jsx';
import NewMasthead from './NewMasthead';
import NewDialog from './NewDialog';
import NewInvoiceDialog from './NewInvoiceDialog';

const badgeLabel = {
  paid: 'Paid',
  pending: 'Awaiting payment',
  cancelled: 'Cancelled',
};

const NewPaymentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [campRegistrations, setCampRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [cancelLoadingId, setCancelLoadingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [campToCancel, setCampToCancel] = useState(null);
  const items = mergePaymentItems(bookings, campRegistrations);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, billing_documents(status, document_nr)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (bookingsError) {
        const fallback = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        setBookings(fallback.data || []);
      } else {
        setBookings(bookingsData || []);
      }
      try {
        setCampRegistrations(await listParentCampRegistrations(user.id));
      } catch (campError) {
        console.error('Camp payments fetch error:', campError);
        setCampRegistrations([]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({ title: 'Error', description: 'Failed to load payments data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleGetInvoice = async (booking) => {
    if (booking.receipt_url) {
      setPreview({ bookingId: booking.id, invoiceUrl: booking.receipt_url });
      return;
    }
    setInvoiceLoadingId(booking.id);
    try {
      const profile = await fetchProfile(user.id);
      const amount = parseFloat(String(booking.price).replace(/[^\d.]/g, ''));
      const data = await requestInvoice({
        booking,
        lesson: { price_amount: amount },
        profile,
        userId: user.id,
      });
      setPreview({ bookingId: booking.id, invoiceUrl: data?.url || null });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'Could not generate the invoice.', variant: 'destructive' });
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const confirmCancel = async () => {
    if (campToCancel) {
      setCancelLoadingId(campToCancel.id);
      try {
        await cancelCampRegistration(campToCancel.id);
        toast({ title: 'Registration cancelled', description: 'The unpaid camp invoice was cancelled.' });
        setCampToCancel(null);
        await fetchData();
      } catch (error) {
        toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      } finally {
        setCancelLoadingId(null);
      }
      return;
    }
    if (!bookingToCancel) return;
    setCancelLoadingId(bookingToCancel.id);
    try {
      await cancelBooking(bookingToCancel.id);
      toast({ title: 'Booking cancelled', description: 'The unpaid invoice was cancelled.' });
      setBookingToCancel(null);
      await fetchData();
    } catch (error) {
      if (/queued for retry/i.test(error.message || '')) {
        toast({ title: 'Booking cancelled', description: 'The invoice cancel will retry automatically.' });
        setBookingToCancel(null);
        await fetchData();
        return;
      }
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
    } finally {
      setCancelLoadingId(null);
    }
  };

  const cancelTarget = bookingToCancel || campToCancel;

  return (
    <>
      <Helmet>
        <title>My Payments | AGC Padel Academy</title>
      </Helmet>
      <NewMasthead title="My Payments" lead="Invoices for lessons and camp registrations. Pay with the QR slip." />
      <section className="nf-page nf-skin">
        <MembershipCollectionSection />
        {loading && <p className="nf-lead">Loading payments…</p>}
        {!loading && items.length === 0 && <p className="nf-lead">You haven&apos;t made any bookings or camp registrations yet.</p>}
        <div className="nf-stack">
          {items.map((item) => (
            item.kind === 'camp' ? (
              <CampCard
                key={`camp-${item.registration.id}`}
                registration={item.registration}
                invoiceLoadingId={invoiceLoadingId}
                cancelLoadingId={cancelLoadingId}
                onInvoice={() => setPreview({ campRegistrationId: item.registration.id })}
                onCancel={() => setCampToCancel(item.registration)}
              />
            ) : (
              <LessonCard
                key={`lesson-${item.booking.id}`}
                booking={item.booking}
                invoiceLoadingId={invoiceLoadingId}
                cancelLoadingId={cancelLoadingId}
                onInvoice={() => handleGetInvoice(item.booking)}
                onCancel={() => setBookingToCancel(item.booking)}
              />
            )
          ))}
        </div>
      </section>
      <NewInvoiceDialog
        open={Boolean(preview)}
        bookingId={preview?.bookingId}
        campRegistrationId={preview?.campRegistrationId}
        invoiceUrl={preview?.invoiceUrl}
        onClose={() => setPreview(null)}
      />
      <NewDialog
        open={Boolean(cancelTarget)}
        title={campToCancel ? 'Cancel registration?' : 'Cancel booking?'}
        onClose={() => {
          if (cancelLoadingId) return;
          setBookingToCancel(null);
          setCampToCancel(null);
        }}
      >
        <p>
          {campToCancel
            ? campPaymentTitle(campToCancel)
            : bookingToCancel?.lesson_name}
        </p>
        <p>This cancels the unpaid invoice. Paid invoices cannot be cancelled here.</p>
        <div className="nf-row">
          <button type="button" className="nf-pill is-quiet" disabled={Boolean(cancelLoadingId)} onClick={() => { setBookingToCancel(null); setCampToCancel(null); }}>Keep it</button>
          <button type="button" className="nf-pill border-0" disabled={Boolean(cancelLoadingId)} onClick={confirmCancel}>
            {cancelLoadingId ? 'Cancelling…' : 'Confirm cancel'}
          </button>
        </div>
      </NewDialog>
    </>
  );
};

const LessonCard = ({ booking, invoiceLoadingId, cancelLoadingId, onInvoice, onCancel }) => {
  const state = paymentInvoiceState(booking);
  const doc = documentOf(booking);
  const canViewInvoice = Boolean(booking.receipt_url || doc || state === 'pending');
  return (
    <article className="nf-card">
      <h3>{booking.lesson_name}</h3>
      <p>{paymentCardDate(booking)} · {booking.price}{doc?.document_nr ? ` · ${doc.document_nr}` : ''}</p>
      <span className={`nf-badge is-${state}`}>{badgeLabel[state] || state}</span>
      <div className="nf-row">
        {canViewInvoice && state !== 'cancelled' && (
          <button type="button" className="nf-pill border-0" disabled={invoiceLoadingId === booking.id} onClick={onInvoice}>
            {invoiceLoadingId === booking.id ? 'Opening…' : (booking.receipt_url || doc ? 'Invoice (PDF)' : 'Get invoice')}
          </button>
        )}
        {state === 'pending' && (
          <button type="button" className="nf-text-btn" disabled={cancelLoadingId === booking.id} onClick={onCancel}>Cancel booking</button>
        )}
      </div>
      {state === 'pending' && <p>Pay with the QR slip on the invoice. This booking is confirmed automatically after the bank transfer is recorded in Bexio. You can cancel it while it is still unpaid.</p>}
      {state === 'paid' && <p>This invoice is paid. Cancellation after payment is not available here yet.</p>}
    </article>
  );
};

const CampCard = ({ registration, invoiceLoadingId, cancelLoadingId, onInvoice, onCancel }) => {
  const state = paymentInvoiceState(registration);
  const doc = documentOf(registration);
  const unpaid = registration.status === 'pending_payment' && registration.payment_status !== 'confirmed';
  const amount = registration.total_amount != null ? `${registration.total_amount} ${registration.currency || 'CHF'}` : null;
  return (
    <article className="nf-card">
      <h3>{campPaymentTitle(registration)}</h3>
      <p>{paymentCardDate(registration)}{amount ? ` · ${amount}` : ''}{doc?.document_nr ? ` · ${doc.document_nr}` : ''}</p>
      <span className={`nf-badge is-${state}`}>{badgeLabel[state] || state}</span>
      <div className="nf-row">
        {state !== 'cancelled' && (
          <button type="button" className="nf-pill border-0" disabled={invoiceLoadingId === registration.id} onClick={onInvoice}>Invoice (PDF)</button>
        )}
        {unpaid && (
          <button type="button" className="nf-text-btn" disabled={cancelLoadingId === registration.id} onClick={onCancel}>Cancel registration</button>
        )}
      </div>
      {state === 'pending' && <p>Pay with the QR slip on the invoice. This camp registration is confirmed automatically after the bank transfer is recorded in Bexio. You can cancel it while it is still unpaid.</p>}
      {state === 'paid' && <p>This invoice is paid. Cancellation after payment is not available here yet.</p>}
    </article>
  );
};

export default NewPaymentsPage;
