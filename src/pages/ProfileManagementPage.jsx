import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, User, Mail, Phone, MapPin, Map, Globe, ShieldCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const ProfileManagementPage = () => {
  const { user, loading: authLoading } = useAuth();
  console.log("AUTH DEBUG:", { user, authLoading });
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  
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
    console.log("ProfileManagementPage mounted");
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (authLoading) return;
      
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setFetchError(null);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          if (error.code === 'PGRST116') {
            const newProfileData = {
              id: user.id,
              full_name: user.user_metadata?.full_name || '',
              email: user.email || '',
            };
            
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert([newProfileData])
              .select()
              .single();
              
            if (insertError) throw insertError;
            
            setFormData(prev => ({
              ...prev,
              full_name: newProfile.full_name || prev.full_name,
              email: newProfile.email || user.email || prev.email,
            }));
            return;
          }
          throw error;
        }
        
        if (data) {
          setFormData(prev => ({
            full_name: data.full_name || prev.full_name,
            email: data.email || user.email || prev.email,
            phone: data.phone || prev.phone,
            address: data.address || prev.address,
            postal_code: data.postal_code || prev.postal_code,
            city: data.city || prev.city,
            country: data.country || prev.country
          }));
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        setFetchError("Could not load your profile details.");
        toast({ title: 'Error loading profile', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, authLoading, toast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({ title: 'Authentication Required', description: 'You must be logged in to save your profile.', variant: 'destructive' });
      return;
    }

    setSaving(true);
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
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Profile Updated', description: 'Your changes have been saved successfully.' });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({ title: 'Update Failed', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isLoadingData = loading || authLoading;

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 text-gray-100 flex justify-center w-full">
      <Helmet><title>My Profile - AGC Padel Academy</title></Helmet>
      
      <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-6 sm:p-10">
        <div className="mb-8 border-b border-gray-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold font-serif flex items-center gap-3 text-white">
              <User className="text-green-500 w-8 h-8" /> 
              Profile Management
            </h1>
            <p className="text-gray-400 mt-3 text-lg">Manage your personal information and billing details.</p>
          </div>
          
          {isLoadingData && (
            <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full font-medium border border-green-500/20">
              <Loader2 className="w-5 h-5 animate-spin" /> 
              <span>Loading data...</span>
            </div>
          )}
        </div>

        {!user && !authLoading && (
          <div className="mb-8 p-5 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-4 text-red-400">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-lg mb-1">Not Logged In</h3>
              <p>Please sign in to securely save and access your profile data.</p>
            </div>
          </div>
        )}

        <Card className="bg-gray-800/50 border-gray-700 text-white shadow-inner">
          <CardHeader className="border-b border-gray-700/50 bg-gray-800/30">
            <CardTitle className="text-2xl text-white">Personal Information</CardTitle>
            <CardDescription className="text-gray-300 text-base">
              Ensure your details are accurate for booking verification and invoicing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Full Name Field */}
              <div className="space-y-3">
                <Label htmlFor="full_name" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <User className="w-4 h-4 text-green-500" /> Full Name
                </Label>
                <Input 
                  id="full_name" 
                  name="full_name" 
                  value={formData.full_name} 
                  onChange={handleChange} 
                  placeholder="e.g. John Doe"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>
              
              {/* Email Field (Read Only) */}
              <div className="space-y-3">
                <Label htmlFor="email" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <Mail className="w-4 h-4 text-green-500" /> Email Address
                </Label>
                <Input 
                  id="email" 
                  name="email" 
                  value={formData.email} 
                  readOnly
                  className="bg-gray-900/80 border-gray-700 text-gray-400 cursor-not-allowed text-base py-6" 
                />
                <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" /> Managed via Authentication
                </p>
              </div>

              {/* Phone Field */}
              <div className="space-y-3">
                <Label htmlFor="phone" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <Phone className="w-4 h-4 text-green-500" /> Phone Number
                </Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  type="tel"
                  value={formData.phone} 
                  onChange={handleChange} 
                  placeholder="+41 79 123 45 67"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>

              {/* Address Field */}
              <div className="space-y-3">
                <Label htmlFor="address" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <MapPin className="w-4 h-4 text-green-500" /> Street Address
                </Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange} 
                  placeholder="Street name and number"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>

              {/* Postal Code Field */}
              <div className="space-y-3">
                <Label htmlFor="postal_code" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <Map className="w-4 h-4 text-green-500" /> Postal Code
                </Label>
                <Input 
                  id="postal_code" 
                  name="postal_code" 
                  value={formData.postal_code} 
                  onChange={handleChange} 
                  placeholder="e.g. 1000"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>

              {/* City Field */}
              <div className="space-y-3">
                <Label htmlFor="city" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  City / Locality
                </Label>
                <Input 
                  id="city" 
                  name="city" 
                  value={formData.city} 
                  onChange={handleChange} 
                  placeholder="e.g. Lausanne"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>

              {/* Country Field */}
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="country" className="flex items-center gap-2 text-gray-200 text-base font-semibold">
                  <Globe className="w-4 h-4 text-green-500" /> Country
                </Label>
                <Input 
                  id="country" 
                  name="country" 
                  value={formData.country} 
                  onChange={handleChange} 
                  placeholder="e.g. Switzerland"
                  className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-green-500 text-base py-6" 
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-gray-800 border-t border-gray-700 p-6 flex justify-end rounded-b-xl">
            <Button 
              onClick={handleSave} 
              className="bg-green-500 text-black hover:bg-green-400 font-bold px-10 py-6 text-lg shadow-lg transition-all" 
              disabled={saving || (!user && !authLoading)}
              size="lg"
            >
              {saving ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : null} 
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ProfileManagementPage;