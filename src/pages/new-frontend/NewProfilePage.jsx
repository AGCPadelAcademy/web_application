import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { profileToFormData } from '@/lib/profileService';
import NewMasthead from './NewMasthead';
import NewProfileFields from './NewProfileFields';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  postal_code: '',
  city: '',
  country_code: '',
  date_of_birth: '',
  role: 'student',
  is_active: true,
};

const NewProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile, isActive, loading, error, saveProfile } = useProfile();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm(profileToFormData(profile, user));
  }, [profile, user]);

  useEffect(() => {
    if (error) toast({ title: 'Error loading profile', description: error.message, variant: 'destructive' });
  }, [error, toast]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveProfile(form);
      toast({ title: 'Profile Updated', description: 'Your changes have been saved successfully.' });
    } catch (err) {
      toast({ title: 'Update Failed', description: err.message || 'Failed to update profile.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Profile - AGC Padel Academy</title>
      </Helmet>
      <NewMasthead title="Profile" lead="Manage your personal information and billing details." />
      <section className="nf-page">
        {loading && <p className="nf-lead">Loading profile…</p>}
        {!loading && profile && !isActive && (
          <p className="nf-note">Your details and history remain available, but changes and new bookings are disabled. Contact the academy.</p>
        )}
        <form className="nf-card" onSubmit={save}>
          <fieldset disabled={!isActive || loading} className="nf-form">
            <NewProfileFields form={form} onChange={onChange} />
            <button type="submit" className="nf-pill border-0" disabled={saving || !isActive}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </fieldset>
        </form>
      </section>
    </>
  );
};

export default NewProfilePage;
