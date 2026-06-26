import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { CreditCard, Clock, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import PaymentProofUpload from '@/components/payments/PaymentProofUpload';
import PaymentProofPreview from '@/components/payments/PaymentProofPreview';

const PaymentsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [proofs, setProofs] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;

      const { data: proofsData, error: proofsError } = await supabase
        .from('payment_proofs')
        .select('*')
        .in('booking_id', bookingsData.map(b => b.id));

      if (proofsError) throw proofsError;

      const proofsMap = proofsData.reduce((acc, proof) => {
        // Only keep the most recent proof if there are multiple
        if (!acc[proof.booking_id] || new Date(proof.upload_date) > new Date(acc[proof.booking_id].upload_date)) {
          acc[proof.booking_id] = proof;
        }
        return acc;
      }, {});

      setBookings(bookingsData || []);
      setProofs(proofsMap);
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

  const PaymentBadge = ({ status }) => {
    switch (status) {
      case 'confirmed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20"><CheckCircle className="w-3 h-3" /> Paid</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><Clock className="w-3 h-3" /> Pending</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">{status}</span>;
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
            {bookings.map(booking => {
              const proof = proofs[booking.id];
              return (
                <div key={booking.id} className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-white mb-1">{booking.lesson_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {booking.booking_date ? format(new Date(booking.booking_date), 'dd MMM yyyy') : 'N/A'}</span>
                        <span className="font-medium text-green-400">{booking.price}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <PaymentBadge status={booking.payment_status} />
                    </div>
                  </div>

                  {booking.payment_status === 'pending' && (!proof || proof.verification_status === 'rejected') && (
                    <div className="mt-4">
                      {proof?.verification_status === 'rejected' && (
                        <div className="mb-4 p-4 border border-red-500/20 bg-red-500/10 rounded-xl text-sm">
                          <p className="text-red-400 font-bold mb-1">Previous Upload Rejected</p>
                          <p className="text-red-200">{proof.admin_notes || 'Please upload a valid payment proof.'}</p>
                        </div>
                      )}
                      <PaymentProofUpload bookingId={booking.id} onUploadSuccess={fetchData} />
                    </div>
                  )}

                  {proof && proof.verification_status !== 'rejected' && (
                    <div className="mt-4">
                      <PaymentProofPreview proof={proof} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default PaymentsPage;