import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { CreditCard, Clock, Calendar, CheckCircle, FileDown, Loader2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { requestInvoice, cancelBooking } from '@/lib/bookings';
import { fetchProfile } from '@/lib/profileService';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import CancelBookingModal from '@/components/modals/CancelBookingModal.jsx';

function documentOf(booking) {
  const docs = booking.billing_documents;
  if (!docs) return null;
  return Array.isArray(docs) ? docs[0] : docs;
}

function invoiceState(booking) {
  const doc = documentOf(booking);
  if (booking.payment_status === 'cancelled' || booking.status === 'cancelled' || doc?.status === 'cancelled') {
    return 'cancelled';
  }
  if (booking.payment_status === 'confirmed' || doc?.status === 'paid') {
    return 'paid';
  }
  return 'pending';
}

const PaymentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [cancelLoadingId, setCancelLoadingId] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookingToCancel, setBookingToCancel] = useState(null);

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
        return;
      }
      setBookings(bookingsData || []);
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
      setSelectedBookingId(booking.id);
      setSelectedInvoiceUrl(booking.receipt_url);
      setInvoiceModalOpen(true);
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
      setSelectedBookingId(booking.id);
      setSelectedInvoiceUrl(data?.url || null);
      setInvoiceModalOpen(true);
      fetchData();
    } catch (error) {
      console.error('Invoice error:', error);
      toast({ title: 'Error', description: error.message || 'Could not generate the invoice.', variant: 'destructive' });
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const closeCancelModal = () => {
    if (cancelLoadingId) return;
    setBookingToCancel(null);
  };

  const confirmCancel = async () => {
    const booking = bookingToCancel;
    if (!booking) return;
    setCancelLoadingId(booking.id);
    try {
      await cancelBooking(booking.id);
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

  const PaymentBadge = ({ state }) => {
    switch (state) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20"><CheckCircle className="w-3 h-3" /> Paid</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Clock className="w-3 h-3" /> Awaiting payment</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20"><XCircle className="w-3 h-3" /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">{state}</span>;
    }
  };

  return (
    <>
      <Helmet><title>My Payments | AGC Padel Academy</title></Helmet>
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="w-8 h-8 text-green-400" />
          <h1 className="text-3xl md:text-4xl font-bold font-serif">My Payments</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div></div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 border border-gray-800 rounded-2xl">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300">No payments found</h3>
            <p className="text-gray-500 mt-2">You haven't made any bookings yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const state = invoiceState(booking);
              const doc = documentOf(booking);
              const canViewInvoice = Boolean(booking.receipt_url || doc || state === 'pending');
              return (
                <div key={booking.id} className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-white mb-1">{booking.lesson_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {booking.booking_date ? format(new Date(booking.booking_date), 'dd MMM yyyy') : 'N/A'}</span>
                        <span className="font-medium text-green-400">{booking.price}</span>
                        {doc?.document_nr && <span>{doc.document_nr}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {canViewInvoice && state !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGetInvoice(booking)}
                          disabled={invoiceLoadingId === booking.id}
                          className="border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                        >
                          {invoiceLoadingId === booking.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="w-4 h-4 mr-2" />
                          )}
                          {booking.receipt_url || doc ? 'Invoice (PDF)' : 'Get invoice'}
                        </Button>
                      )}
                      {state === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBookingToCancel(booking)}
                          disabled={cancelLoadingId === booking.id}
                          className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          {cancelLoadingId === booking.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Cancel booking
                        </Button>
                      )}
                      <PaymentBadge state={state} />
                    </div>
                  </div>

                  {state === 'pending' && (
                    <p className="text-sm text-gray-400">
                      Pay with the QR slip on the invoice. This booking is confirmed automatically after the bank transfer is recorded in Bexio. You can cancel it while it is still unpaid.
                    </p>
                  )}
                  {state === 'paid' && (
                    <p className="text-sm text-gray-400">
                      This invoice is paid. Cancellation after payment is not available here yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <InvoicePreviewModal
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          setSelectedInvoiceUrl(null);
        }}
        bookingId={selectedBookingId}
        invoiceUrl={selectedInvoiceUrl}
      />
      <CancelBookingModal
        open={Boolean(bookingToCancel)}
        booking={bookingToCancel}
        loading={Boolean(bookingToCancel && cancelLoadingId === bookingToCancel.id)}
        onClose={closeCancelModal}
        onConfirm={confirmCancel}
      />
    </>
  );
};

export default PaymentsPage;
