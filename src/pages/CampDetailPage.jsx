import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ProfileCompletionModal from '@/components/modals/ProfileCompletionModal';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import { fetchProfile } from '@/lib/profileService';
import { isProfileComplete } from '@/lib/profileValidation';
import { listChildren } from '@/lib/children';
import {
  CAMP_FULL_LABEL,
  CAMPS_TERMS_VERSION,
  campDisplayTotal,
  campInvoicePreviewFromSubmit,
  clearCampDraft,
  deriveCampStatus,
  fetchPublicCamp,
  formatCampExtraChoice,
  formatCampPrice,
  FUNNEL_EVENTS,
  joinCampWaitlist,
  mapCampError,
  readCampDraft,
  submitCampRegistration,
  trackCampFunnelEvent,
  writeCampDraft,
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
  const [memberClaimed, setMemberClaimed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [previewRegistrationId, setPreviewRegistrationId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Restore a preserved draft (terms navigation), then
  // apply ?select_child= if returning from the Children page.
  useEffect(() => {
    if (!camp) return;
    const draft = readCampDraft(camp.id, sessionStorage);
    if (draft) {
      if (draft.childId) setChildId(draft.childId);
      if (draft.selectedExtras.length > 0) setSelectedExtras(draft.selectedExtras);
      if (draft.termsAccepted) setTermsAccepted(true);
      if (draft.memberClaimed) setMemberClaimed(true);
    }
    const selectChild = searchParams.get('select_child');
    if (selectChild) {
      setChildId(selectChild);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camp]);

  // Persist the draft so leaving for /terms or child creation restores it.
  useEffect(() => {
    if (!camp) return;
    writeCampDraft(camp.id, { childId, selectedExtras, termsAccepted, memberClaimed }, sessionStorage);
  }, [camp, childId, selectedExtras, termsAccepted, memberClaimed]);

  // Drop a restored child that no longer exists on the parent's list.
  useEffect(() => {
    if (childId && children.length > 0 && !children.some((child) => child.id === childId)) {
      setChildId('');
    }
  }, [children, childId]);

  const extras = useMemo(() => Array.isArray(camp?.extras) ? camp.extras : [], [camp]);
  const chosenExtras = extras.filter((extra) => selectedExtras.includes(extra.id));
  const status = deriveCampStatus(camp);
  const memberBase = memberClaimed && camp?.member_price_amount != null ? Number(camp.member_price_amount) : null;
  const total = campDisplayTotal(camp, chosenExtras, memberBase);

  const goAddChild = () => {
    if (camp?.id) {
      writeCampDraft(camp.id, { childId, selectedExtras, termsAccepted, memberClaimed }, sessionStorage);
    }
    navigate(`/children?new=1&return_to=${encodeURIComponent(`/camps/${slug}`)}`);
  };

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
      const result = await submitCampRegistration({
        campId: camp.id,
        childId,
        extraIds: selectedExtras,
        termsVersion: CAMPS_TERMS_VERSION,
        membershipClaimed: memberClaimed,
      });
      trackCampFunnelEvent(FUNNEL_EVENTS.COMPLETED, camp.id);
      clearCampDraft(camp.id, sessionStorage);
      const preview = campInvoicePreviewFromSubmit(result);
      if (preview.campRegistrationId) {
        setPreviewRegistrationId(preview.campRegistrationId);
        setInvoiceOpen(true);
        toast({
          title: 'Registration submitted',
          description: preview.documentReady
            ? 'Review the invoice and scan the QR code to pay.'
            : 'Your invoice is being prepared. You can reopen it from My Payments.',
        });
      } else {
        toast({ title: 'Registration submitted', description: 'Your invoice will appear under My Payments.' });
        navigate('/payments');
      }
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
                  {status === 'open' && (
                    <Button type="button" variant="outline" onClick={goAddChild} className="mt-2 border-gray-700 text-gray-200">
                      + Add new Child
                    </Button>
                  )}
                </div>
              </>
            )}

            {status === 'open' && camp.member_price_amount != null && (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={memberClaimed} onCheckedChange={(value) => setMemberClaimed(Boolean(value))} />
                <span>
                  I have an active academy membership ({formatCampPrice(camp.member_price_amount, camp.currency)}
                  {' '}instead of {formatCampPrice(camp.price_amount, camp.currency)}).
                </span>
              </label>
            )}

            {user && status === 'open' && extras.length > 0 && (
              <div>
                <p className="font-medium mb-2">Extras</p>
                {extras.map((extra) => {
                  const choice = formatCampExtraChoice(extra, camp.currency);
                  return (
                    <label key={extra.id} className="flex items-start gap-2 text-sm mb-3">
                      <Checkbox className="mt-0.5" checked={selectedExtras.includes(extra.id)} onCheckedChange={() => toggleExtra(extra.id)} />
                      <span>
                        {choice.name} · {choice.price}
                        {choice.description ? (
                          <span className="block text-gray-400 mt-0.5">{choice.description}</span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {status === 'open' && (
              <div>
                <p className="text-sm text-gray-400">Registration total</p>
                <p className="text-2xl font-bold text-green-400">{formatCampPrice(total, camp.currency)}</p>
              </div>
            )}

            {user && (
              <>
                {status === 'open' && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(Boolean(value))} />
                    <span>I accept the <Link to={`/terms?return_to=${encodeURIComponent(`/camps/${slug}`)}`} className="text-green-400">terms and conditions</Link> (version {CAMPS_TERMS_VERSION}).</span>
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
      <InvoicePreviewModal
        isOpen={invoiceOpen}
        campRegistrationId={previewRegistrationId}
        onClose={() => {
          setInvoiceOpen(false);
          setPreviewRegistrationId(null);
          navigate('/payments');
        }}
      />
    </>
  );
};

export default CampDetailPage;
