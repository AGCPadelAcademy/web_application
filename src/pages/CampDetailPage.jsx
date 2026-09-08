import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProfileCompletionModal from '@/components/modals/ProfileCompletionModal';
import { fetchProfile } from '@/lib/profileService';
import { isProfileComplete } from '@/lib/profileValidation';
import { createChild, listChildren } from '@/lib/children';
import {
  CAMP_FULL_LABEL,
  CAMPS_TERMS_VERSION,
  campDisplayTotal,
  deriveCampStatus,
  fetchPublicCamp,
  formatCampPrice,
  FUNNEL_EVENTS,
  joinCampWaitlist,
  mapCampError,
  submitCampRegistration,
  trackCampFunnelEvent,
} from '@/lib/camps';

const CampDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isActive } = useAuth();
  const { toast } = useToast();
  const [camp, setCamp] = useState(null);
  const [campLoadError, setCampLoadError] = useState('');
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newChild, setNewChild] = useState({ first_name: '', last_name: '', date_of_birth: '', emergency_contact_name: '', emergency_contact_phone: '' });

  useEffect(() => {
    setCamp(null);
    setCampLoadError('');
    fetchPublicCamp(slug).then((row) => {
      if (!row) {
        setCampLoadError('This camp is not published or does not exist.');
        return;
      }
      setCamp(row);
      if (row.id) trackCampFunnelEvent(FUNNEL_EVENTS.STARTED, row.id);
    }).catch((error) => {
      setCampLoadError(error.message || 'Camp unavailable');
      toast({ title: 'Camp unavailable', description: error.message, variant: 'destructive' });
    });
  }, [slug, toast]);

  useEffect(() => {
    if (!user) return;
    listChildren().then(setChildren).catch(() => setChildren([]));
  }, [user]);

  const extras = useMemo(() => Array.isArray(camp?.extras) ? camp.extras : [], [camp]);
  const chosenExtras = extras.filter((extra) => selectedExtras.includes(extra.id));
  const status = deriveCampStatus(camp);
  const total = campDisplayTotal(camp, chosenExtras);

  const ensureReady = async () => {
    if (!user) {
      navigate(`/login?return_to=${encodeURIComponent(`/camps/${slug}`)}`);
      return false;
    }
    const profile = await fetchProfile(user.id);
    if (profile?.is_active === false || isActive === false) {
      toast({ title: 'Registration unavailable', description: 'This client profile is inactive. Contact the academy.', variant: 'destructive' });
      return false;
    }
    if (!isProfileComplete(profile)) {
      setProfileModalOpen(true);
      return false;
    }
    return true;
  };

  const handleRegisterCta = async () => {
    await ensureReady();
  };

  const toggleExtra = (id) => {
    setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const addChildInline = async (event) => {
    event.preventDefault();
    try {
      const created = await createChild(newChild, user.id);
      setChildren((items) => [...items, created]);
      setChildId(created.id);
      toast({ title: 'Child saved' });
    } catch (error) {
      toast({ title: 'Could not save child', description: error.message, variant: 'destructive' });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!(await ensureReady())) return;
    if (!childId) {
      toast({ title: 'Select a child', variant: 'destructive' });
      return;
    }
    if (!termsAccepted) {
      toast({ title: 'Please accept the terms', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await submitCampRegistration({
        campId: camp.id,
        childId,
        extraIds: selectedExtras,
        termsVersion: CAMPS_TERMS_VERSION,
      });
      trackCampFunnelEvent(FUNNEL_EVENTS.COMPLETED, camp.id);
      toast({ title: 'Registration submitted', description: 'Your invoice will appear under My Children.' });
      navigate('/children');
    } catch (error) {
      toast({ title: 'Registration failed', description: mapCampError(error.message), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const joinWaitlist = async () => {
    if (!(await ensureReady())) return;
    if (!childId) {
      toast({ title: 'Select a child for the waitlist', variant: 'destructive' });
      return;
    }
    try {
      await joinCampWaitlist({ campId: camp.id, childId, parentId: user.id });
      toast({ title: 'Added to the waitlist' });
    } catch (error) {
      toast({ title: 'Waitlist failed', description: mapCampError(error.message), variant: 'destructive' });
    }
  };

  if (campLoadError) {
    return (
      <div className="px-6 py-24 text-center max-w-xl mx-auto">
        <p className="text-red-400 mb-4">{campLoadError}</p>
        <Link to="/camps" className="text-sm text-green-400">← All camps</Link>
      </div>
    );
  }

  if (!camp) {
    return <div className="px-6 py-24 text-center text-gray-400">Loading camp…</div>;
  }

  return (
    <>
      <Helmet>
        <title>{camp.name} - Camps</title>
      </Helmet>
      <div className="px-6 py-12 md:py-24 max-w-3xl mx-auto w-full">
        <Link to="/camps" className="text-sm text-green-400">← All camps</Link>
        <h1 className="text-3xl md:text-5xl font-bold font-serif mt-4 mb-2">{camp.name}</h1>
        <p className="text-gray-400 mb-4">{camp.start_date} → {camp.end_date}</p>
        {camp.schedule_text && <p className="mb-2">{camp.schedule_text}</p>}
        {(camp.min_age != null || camp.max_age != null) && <p className="mb-2 text-sm">Ages {camp.min_age ?? '—'}–{camp.max_age ?? '—'}</p>}
        {camp.eligibility_text && <p className="mb-2 text-sm text-gray-300">{camp.eligibility_text}</p>}
        <p className="text-2xl font-bold text-green-400 mb-4">{formatCampPrice(camp.price_amount, camp.currency)}</p>
        {camp.description && <p className="text-gray-300 mb-6">{camp.description}</p>}
        <p className="font-semibold mb-6">{status === 'full' ? CAMP_FULL_LABEL : status === 'open' ? 'Registration open' : 'Registration closed'}</p>

        {status === 'closed' && (
          <Button disabled className="bg-gray-800 text-gray-500">Registration closed</Button>
        )}

        {(status === 'open' || status === 'full') && (
          <form onSubmit={status === 'open' ? submit : (e) => { e.preventDefault(); joinWaitlist(); }} className="space-y-6 border border-gray-800 rounded-2xl p-6 bg-gray-950">
            {!user && (
              <Button type="button" onClick={handleRegisterCta} className="bg-green-500 text-black font-bold w-full">
                Sign in to register
              </Button>
            )}

            {user && (
              <>
                <div>
                  <Label>Child</Label>
                  <select value={childId} onChange={(e) => setChildId(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-gray-700 bg-gray-950 px-3 text-sm">
                    <option value="">Select a saved child</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>{child.first_name} {child.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="First name" value={newChild.first_name} onChange={(e) => setNewChild((c) => ({ ...c, first_name: e.target.value }))} className="bg-gray-900 border-gray-700" />
                  <Input placeholder="Last name" value={newChild.last_name} onChange={(e) => setNewChild((c) => ({ ...c, last_name: e.target.value }))} className="bg-gray-900 border-gray-700" />
                  <Input type="date" value={newChild.date_of_birth} onChange={(e) => setNewChild((c) => ({ ...c, date_of_birth: e.target.value }))} className="bg-gray-900 border-gray-700" />
                  <Input placeholder="Emergency contact" value={newChild.emergency_contact_name} onChange={(e) => setNewChild((c) => ({ ...c, emergency_contact_name: e.target.value }))} className="bg-gray-900 border-gray-700" />
                  <Input placeholder="Emergency phone" value={newChild.emergency_contact_phone} onChange={(e) => setNewChild((c) => ({ ...c, emergency_contact_phone: e.target.value }))} className="bg-gray-900 border-gray-700 md:col-span-2" />
                  <Button type="button" variant="outline" onClick={addChildInline} className="md:col-span-2 border-gray-700">Save new child</Button>
                </div>

                {status === 'open' && extras.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Extras</p>
                    {extras.map((extra) => (
                      <label key={extra.id} className="flex items-center gap-2 text-sm mb-2">
                        <Checkbox checked={selectedExtras.includes(extra.id)} onCheckedChange={() => toggleExtra(extra.id)} />
                        {extra.name} · {formatCampPrice(extra.price_amount, camp.currency)}
                      </label>
                    ))}
                    <p className="text-green-400 font-semibold">Total: {formatCampPrice(total, camp.currency)}</p>
                  </div>
                )}

                {status === 'open' && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(Boolean(value))} />
                    <span>I accept the <Link to="/terms" className="text-green-400">terms and conditions</Link> (version {CAMPS_TERMS_VERSION}).</span>
                  </label>
                )}

                {status === 'open' ? (
                  <Button type="submit" disabled={submitting} className="w-full bg-green-500 text-black font-bold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit registration'}
                  </Button>
                ) : camp.waitlist_enabled ? (
                  <Button type="submit" className="w-full bg-gray-800 text-white">{CAMP_FULL_LABEL} — join waitlist</Button>
                ) : (
                  <Button type="button" disabled className="w-full bg-gray-800 text-gray-500">{CAMP_FULL_LABEL}</Button>
                )}
              </>
            )}
          </form>
        )}
      </div>
      <ProfileCompletionModal open={profileModalOpen} onOpenChange={setProfileModalOpen} onSaveSuccess={() => setProfileModalOpen(false)} />
    </>
  );
};

export default CampDetailPage;
