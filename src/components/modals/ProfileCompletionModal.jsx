
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProfileCompletionModal = ({ open, onOpenChange, onSaveSuccess, onCancel }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    country: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id || !open) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (data) {
        setFormData({
          full_name: data.full_name || user.user_metadata?.full_name || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          address: data.address || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
          country: data.country || ''
        });
      }
    };
    fetchProfile();
  }, [user, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (formData.phone.length < 10) {
      toast({ title: 'Validation Error', description: 'Phone number must be at least 10 digits.', variant: 'destructive' });
      return;
    }
    if (formData.postal_code.length < 3) {
      toast({ title: 'Validation Error', description: 'Postal code must be at least 3 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          postal_code: formData.postal_code,
          city: formData.city,
          country: formData.country,
          // email not updated, it's read-only and managed by auth
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Profile Updated', description: 'Your profile has been completed successfully.' });
      
      if (onSaveSuccess) {
        onSaveSuccess(formData);
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleInteractOutside = (e) => {
    e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && onCancel) onCancel(); }}>
      <DialogContent 
        className="bg-gray-900 border-gray-700 text-white rounded-2xl sm:max-w-[500px]"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleInteractOutside}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl text-green-400">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-gray-400">
            Please fill in your details to continue with the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" value={formData.email} readOnly className="bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" value={formData.address} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="postal_code">Postal Code</Label>
              <Input id="postal_code" name="postal_code" value={formData.postal_code} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" value={formData.country} onChange={handleChange} required className="bg-gray-800 border-gray-700 text-white" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={loading} className="border-gray-600 hover:bg-gray-800 text-white">Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-green-500 hover:bg-green-600 text-black font-bold">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionModal;
