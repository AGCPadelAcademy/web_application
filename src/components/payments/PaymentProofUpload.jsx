
import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const PaymentProofUpload = ({ bookingId, onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be under 5MB', variant: 'destructive' });
      return;
    }

    // Validate type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Only PDF, JPG, and PNG files are allowed', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${bookingId}_${Date.now()}.${fileExt}`;
      const filePath = `${bookingId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Insert into payment_proofs
      const { error: dbError } = await supabase.from('payment_proofs').insert({
        booking_id: bookingId,
        file_url: filePath,
        verification_status: 'pending'
      });

      if (dbError) throw dbError;

      // Update booking
      await supabase.from('bookings').update({ 
        verification_status: 'pending',
        proof_uploaded_at: new Date().toISOString()
      }).eq('id', bookingId);

      toast({ title: 'Success', description: 'Payment proof uploaded successfully. Awaiting verification.' });
      if (onUploadSuccess) onUploadSuccess();
      setSelectedFile(null);

    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 bg-gray-900/30 text-center transition-colors hover:bg-gray-900/50">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept=".pdf, .jpg, .jpeg, .png" 
        className="hidden" 
      />
      
      {!selectedFile ? (
        <div className="flex flex-col items-center">
          <UploadCloud className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-gray-300 font-medium mb-1">Upload Payment Proof</p>
          <p className="text-sm text-gray-500 mb-4">PDF, JPG or PNG (Max 5MB)</p>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-gray-600">
            Select File
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <FileText className="w-10 h-10 text-green-500 mb-3" />
          <p className="text-sm font-medium truncate w-full max-w-xs mb-4 text-gray-300">{selectedFile.name}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedFile(null)} disabled={isUploading} className="border-gray-600">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isUploading} className="bg-green-500 text-black hover:bg-green-600">
              {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : 'Confirm Upload'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentProofUpload;
