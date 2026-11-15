import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { profileToFormData } from '@/lib/profileService';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import NewDialog from './NewDialog';
import NewProfileFields from './NewProfileFields';

const NewProfileDialog = ({ open, onClose, onSaved }) => {
  const { user } = useAuth();
  const { profile, loading, saveProfile } = useProfile();
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm(profileToFormData(profile, user));
  }, [profile, user]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await saveProfile(form);
      toast({ title: 'Profile updated', description: 'Your billing details are saved.' });
      onSaved(updated);
    } catch (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <NewDialog open={open} title="Complete your profile" onClose={onClose}>
      <p className="nf-lead">Billing details are required before a booking or a camp registration.</p>
      {loading || !form ? <p>Loading profile…</p> : (
        <form className="nf-form" onSubmit={save}>
          <NewProfileFields form={form} onChange={onChange} />
          <div className="nf-row">
            <button type="button" className="nf-pill is-quiet" onClick={onClose}>Cancel</button>
            <button type="submit" className="nf-pill border-0" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      )}
    </NewDialog>
  );
};

export default NewProfileDialog;
