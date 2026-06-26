
import React, { useState, useEffect } from 'react';
import { FileText, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';

const PaymentProofPreview = ({ proof }) => {
  const [signedUrl, setSignedUrl] = useState(null);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(proof.file_url, 86400); // 24 hours
        
      if (!error && data) {
        setSignedUrl(data.signedUrl);
      }
    };
    fetchSignedUrl();
  }, [proof.file_url]);

  const getStatusDisplay = () => {
    switch (proof.verification_status) {
      case 'approved':
        return { color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', icon: <CheckCircle className="w-4 h-4" />, label: 'Approved' };
      case 'rejected':
        return { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', icon: <AlertCircle className="w-4 h-4" />, label: 'Rejected' };
      default:
        return { color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: <Clock className="w-4 h-4" />, label: 'Pending Verification' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/50">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm text-gray-200">Payment Voucher Uploaded</p>
            <p className="text-xs text-gray-500">{format(new Date(proof.upload_date), 'dd MMM yyyy HH:mm')}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color}`}>
          {status.icon} {status.label}
        </div>
      </div>

      {proof.verification_status === 'rejected' && proof.admin_notes && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
          <span className="font-semibold text-red-400">Admin Note:</span> {proof.admin_notes}
        </div>
      )}

      {signedUrl && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" className="border-gray-600" asChild>
            <a href={signedUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="w-4 h-4 mr-2" /> View File
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default PaymentProofPreview;
