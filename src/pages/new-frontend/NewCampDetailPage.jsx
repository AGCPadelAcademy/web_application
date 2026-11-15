import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
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
import NewMasthead from './NewMasthead';
import NewInvoiceDialog from './NewInvoiceDialog';
import NewProfileDialog from './NewProfileDialog';

const NewCampDetailPage = () => {
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [previewRegistrationId, setPreviewRegistrationId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const here = `/new/kids/${slug}`;

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
    });
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    listChildren().then(setChildren).catch(() => setChildren([]));
  }, [user]);

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
    // Same restore-once behaviour as the live camp page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camp]);

  useEffect(() => {
    if (!camp) return;
    writeCampDraft(camp.id, { childId, selectedExtras, termsAccepted, memberClaimed }, sessionStorage);
  }, [camp, childId, selectedExtras, termsAccepted, memberClaimed]);

  useEffect(() => {
    if (childId && children.length > 0 && !children.some((child) => child.id === childId)) {
      setChildId('');
    }
  }, [children, childId]);

  const extras = useMemo(() => (Array.isArray(camp?.extras) ? camp.extras : []), [camp]);
  const chosenExtras = extras.filter((extra) => selectedExtras.includes(extra.id));
  const status = deriveCampStatus(camp);
  const memberBase = memberClaimed && camp?.member_price_amount != null ? Number(camp.member_price_amount) : null;
  const total = camp ? campDisplayTotal(camp, chosenExtras, memberBase) : 0;

  const ensureReady = async () => {
    if (!user) {
      navigate(`/new/login?return_to=${encodeURIComponent(here)}`);
      return false;
    }
    const profile = await fetchProfile(user.id);
    if (profile?.is_active === false || isActive === false) {
      toast({ title: 'Registration unavailable', description: 'This client profile is inactive. Contact the academy.', variant: 'destructive' });
      return false;
    }
    if (!isProfileComplete(profile)) {
      setProfileOpen(true);
      return false;
    }
    return true;
  };

  const toggleExtra = (id) => {
    setSelectedExtras((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
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
        navigate('/new/payments');
      }
    } catch (error) {
      toast({ title: 'Registration failed', description: mapCampError(error.message), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const joinWaitlist = async (event) => {
    event.preventDefault();
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
      <section className="nf-page">
        <p className="nf-error">{campLoadError}</p>
        <Link to="/new/kids" className="nf-pill">All camps</Link>
      </section>
    );
  }

  if (!camp) {
    return <p className="nf-lead" style={{ padding: '48px 8%' }}>Loading camp…</p>;
  }

  return (
    <>
      <Helmet>
        <title>{camp.name} — Kids Academy</title>
      </Helmet>
      <NewMasthead title={camp.name} lead={`${camp.start_date} → ${camp.end_date}`} />
      <section className="nf-page">
        <Link to="/new/kids" className="nf-back">All camps</Link>
        {camp.schedule_text && <p>{camp.schedule_text}</p>}
        {(camp.min_age != null || camp.max_age != null) && <p>Ages {camp.min_age ?? '—'}–{camp.max_age ?? '—'}</p>}
        {camp.eligibility_text && <p>{camp.eligibility_text}</p>}
        {camp.description && <p className="nf-lead">{camp.description}</p>}
        <p className={`nf-camp-status is-${status}`}>
          {status === 'full' ? CAMP_FULL_LABEL : status === 'open' ? 'Registration open' : 'Registration closed'}
        </p>

        {status === 'closed' && <button type="button" className="nf-pill" disabled>Registration closed</button>}

        {(status === 'open' || status === 'full') && (
          <form className="nf-card nf-form" onSubmit={status === 'open' ? submit : joinWaitlist}>
            {!user && (
              <button type="button" className="nf-pill border-0" onClick={ensureReady}>Sign in to register</button>
            )}
            {user && (
              <>
                <label htmlFor="nf-camp-child">Child</label>
                <select id="nf-camp-child" value={childId} onChange={(event) => setChildId(event.target.value)}>
                  <option value="">Select a saved child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.first_name} {child.last_name}</option>
                  ))}
                </select>
                {status === 'open' && (
                  <Link to={`/new/children?return_to=${encodeURIComponent(here)}`} className="nf-pill is-quiet">Add a child</Link>
                )}
              </>
            )}

            {status === 'open' && camp.member_price_amount != null && (
              <label className="nf-check">
                <input type="checkbox" checked={memberClaimed} onChange={(event) => setMemberClaimed(event.target.checked)} />
                <span>
                  I have an active academy membership ({formatCampPrice(camp.member_price_amount, camp.currency)} instead of {formatCampPrice(camp.price_amount, camp.currency)}).
                </span>
              </label>
            )}

            {user && status === 'open' && extras.length > 0 && (
              <div>
                <p className="nf-kicker">Extras</p>
                {extras.map((extra) => {
                  const choice = formatCampExtraChoice(extra, camp.currency);
                  return (
                    <label key={extra.id} className="nf-check">
                      <input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                      <span>
                        {choice.name} · {choice.price}
                        {choice.description ? <small>{choice.description}</small> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {status === 'open' && (
              <p className="nf-price">Total {formatCampPrice(total, camp.currency)}</p>
            )}

            {user && status === 'open' && (
              <label className="nf-check">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                <span>
                  I accept the <Link to={`/new/terms?return_to=${encodeURIComponent(here)}`}>terms and conditions</Link> (version {CAMPS_TERMS_VERSION}).
                </span>
              </label>
            )}

            {user && status === 'open' && (
              <button type="submit" className="nf-pill border-0" disabled={submitting}>
                {submitting ? 'Sending…' : 'Submit registration'}
              </button>
            )}
            {user && status === 'full' && camp.waitlist_enabled && (
              <button type="submit" className="nf-pill is-quiet border-0">{CAMP_FULL_LABEL} — join waitlist</button>
            )}
            {user && status === 'full' && !camp.waitlist_enabled && (
              <button type="button" className="nf-pill" disabled>{CAMP_FULL_LABEL}</button>
            )}
          </form>
        )}
      </section>
      <NewProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={() => setProfileOpen(false)} />
      <NewInvoiceDialog
        open={invoiceOpen}
        campRegistrationId={previewRegistrationId}
        onClose={() => {
          setInvoiceOpen(false);
          setPreviewRegistrationId(null);
          navigate('/new/payments');
        }}
      />
    </>
  );
};

export default NewCampDetailPage;
