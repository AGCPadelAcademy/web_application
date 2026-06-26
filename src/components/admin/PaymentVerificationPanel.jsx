
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Eye, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';

const PaymentVerificationPanel = () => {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const { toast } = useToast();

  const fetchProofs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_proofs')
        .select(`
          *,
          bookings(id, lesson_name, booking_date, price, user_id, profiles(full_name, email))
        `)
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setProofs(data || []);
    } catch (error) {
      console.error('Error fetching proofs:', error);
      toast({ title: 'Error', description: 'Failed to fetch payment proofs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProofs();
  }, []);

  const handleVerification = async (proof, status) => {
    setProcessingId(proof.id);
    try {
      const note = adminNotes[proof.id] || '';

      // Update payment_proofs
      const { error: proofError } = await supabase
        .from('payment_proofs')
        .update({ verification_status: status, admin_notes: note })
        .eq('id', proof.id);
      if (proofError) throw proofError;

      // Update bookings
      let bookingUpdate = { verification_status: status };
      if (status === 'approved') {
        bookingUpdate.payment_status = 'confirmed';
        bookingUpdate.status = 'confirmed';
      } else if (status === 'rejected') {
        bookingUpdate.payment_status = 'pending';
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', proof.booking_id);
      if (bookingError) throw bookingError;

      // Notify User via Edge Function
      const userEmail = proof.bookings?.profiles?.email;
      if (userEmail) {
        supabase.functions.invoke('notify-payment-verification', {
          body: { 
            booking_id: proof.booking_id, 
            user_email: userEmail, 
            status, 
            admin_notes: note 
          }
        }).catch(err => console.warn('Notification error:', err));
      }

      toast({ title: 'Success', description: `Payment proof ${status} successfully.` });
      fetchProofs();
    } catch (error) {
      console.error('Verification error:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const openSignedUrl = async (fileUrl) => {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(fileUrl, 86400);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast({ title: 'Error', description: 'Could not open file', variant: 'destructive' });
    }
  };

  const renderTable = (statusFilter) => {
    const filtered = proofs.filter(p => p.verification_status === statusFilter);

    if (loading) {
      return <div className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto text-green-500" /></div>;
    }

    if (filtered.length === 0) {
      return <div className="py-8 text-center text-gray-500">No {statusFilter} proofs found.</div>;
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-800 text-gray-100">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Booking Info</th>
              <th className="px-4 py-3 font-semibold">Upload Date</th>
              <th className="px-4 py-3 font-semibold">File</th>
              <th className="px-4 py-3 font-semibold">Notes / Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900/50">
            {filtered.map(proof => (
              <tr key={proof.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 font-medium">
                  {proof.bookings?.profiles?.full_name || 'Unknown'}
                  <div className="text-xs text-gray-500">{proof.bookings?.profiles?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-green-400">{proof.bookings?.price}</div>
                  <div className="text-xs">{proof.bookings?.lesson_name}</div>
                  <div className="text-xs text-gray-500">{proof.bookings?.booking_date}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {format(new Date(proof.upload_date), 'dd MMM yyyy HH:mm')}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" onClick={() => openSignedUrl(proof.file_url)} className="text-blue-400 hover:text-blue-300 px-2 h-8">
                    <Eye className="w-4 h-4 mr-1" /> View
                  </Button>
                </td>
                <td className="px-4 py-3 min-w-[250px]">
                  {statusFilter === 'pending' ? (
                    <div className="space-y-2">
                      <Input 
                        placeholder="Admin notes (if rejected)..." 
                        value={adminNotes[proof.id] || ''}
                        onChange={(e) => setAdminNotes({...adminNotes, [proof.id]: e.target.value})}
                        className="h-8 text-xs bg-gray-950 border-gray-700"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleVerification(proof, 'approved')}
                          disabled={processingId === proof.id}
                          className="bg-green-500 hover:bg-green-600 text-black h-8 flex-1"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleVerification(proof, 'rejected')}
                          disabled={processingId === proof.id}
                          className="h-8 flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      {proof.admin_notes ? <p>Note: {proof.admin_notes}</p> : 'No notes'}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-green-400" />
        <h2 className="text-xl font-bold">Payment Proof Verification</h2>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="bg-gray-950 border border-gray-800 mb-4">
          <TabsTrigger value="pending" className="data-[state=active]:bg-gray-800">Pending</TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-gray-800 text-green-400">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-gray-800 text-red-400">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">{renderTable('pending')}</TabsContent>
        <TabsContent value="approved">{renderTable('approved')}</TabsContent>
        <TabsContent value="rejected">{renderTable('rejected')}</TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentVerificationPanel;
