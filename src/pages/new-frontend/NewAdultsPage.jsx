import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { buildBookingPayload, createBooking, requestInvoice } from '@/lib/bookings';
import { fetchProfile } from '@/lib/profileService';
import { isProfileComplete } from '@/lib/profileValidation';
import NewMasthead from './NewMasthead';
import NewDialog from './NewDialog';
import NewInvoiceDialog from './NewInvoiceDialog';
import NewProfileDialog from './NewProfileDialog';

const NewAdultsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [booking, setBooking] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    supabase
      .from('lessons')
      .select('*')
      .eq('is_active', true)
      .order('price_amount', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setLessons(data);
        setLoading(false);
      });
  }, []);

  const memberships = lessons.filter((lesson) => lesson.is_subscription);
  const sessions = lessons.filter((lesson) => !lesson.is_subscription);

  const openBooking = async (lesson) => {
    if (!user) {
      navigate(`/new/login?return_to=${encodeURIComponent('/new/adults')}`);
      return;
    }
    const row = await fetchProfile(user.id);
    if (row?.is_active === false) {
      toast({ title: 'Booking unavailable', description: 'This client profile is inactive. Contact the academy.', variant: 'destructive' });
      return;
    }
    setSelected(lesson);
    if (!isProfileComplete(row)) {
      setProfileOpen(true);
      return;
    }
    setProfile(row);
    setComments('');
    setTermsAccepted(false);
  };

  const confirm = async () => {
    if (!termsAccepted) {
      toast({ title: 'Terms', description: 'You must accept the terms and conditions to proceed.', variant: 'destructive' });
      return;
    }
    setBooking(true);
    try {
      const inserted = await createBooking(buildBookingPayload({
        userId: user.id,
        lesson: selected,
        bookingDate: null,
        selectedTime: null,
        profile,
        comments,
      }), { isActive: profile?.is_active });
      setSelected(null);
      try {
        const issued = await requestInvoice({
          booking: inserted,
          lesson: selected,
          profile,
          userId: user.id,
        });
        toast({
          title: 'Booking successful',
          description: 'Your invoice has been generated and emailed. Scan the QR code to pay.',
        });
        setInvoice({ bookingId: inserted.id, invoiceUrl: issued?.url || null });
      } catch (invoiceError) {
        console.error('Invoice error:', invoiceError);
        toast({
          title: 'Booking successful',
          description: 'Your lesson is booked. The invoice could not be issued yet and will be retried.',
        });
        navigate('/new/payments');
      }
    } catch (error) {
      toast({ title: 'Booking error', description: error.message, variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  };

  const cards = (items, action) => (
    <div className="nf-grid nf-grid-3">
      {items.map((lesson) => (
        <article key={lesson.id} className="nf-card">
          <h3>{lesson.name}</h3>
          <div className="nf-price">{lesson.price_amount} CHF</div>
          <p>{lesson.description}</p>
          <p>Cancellation: 48 h</p>
          <button type="button" className="nf-pill border-0" onClick={() => openBooking(lesson)}>{action}</button>
        </article>
      ))}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Adult Training</title>
      </Helmet>
      <NewMasthead
        title="Adult Training"
        lead="Choose a lesson. The academy assigns your class. Payment is by invoice."
      />
      <div className="nf-page">
        {loading && <p className="nf-lead">Loading lessons…</p>}
        {!loading && memberships.length > 0 && (
          <section className="nf-block" aria-labelledby="adult-memberships">
            <p className="nf-kicker">Weekly group</p>
            <h2 id="adult-memberships">Memberships</h2>
            {cards(memberships, 'Book now')}
          </section>
        )}
        {!loading && sessions.length > 0 && (
          <section className="nf-block" aria-labelledby="adult-private">
            <p className="nf-kicker">One to one</p>
            <h2 id="adult-private">Private sessions</h2>
            {cards(sessions, 'Book now')}
          </section>
        )}
        {!loading && lessons.length === 0 && <p className="nf-lead">No lessons are published right now.</p>}
      </div>

      <NewDialog open={Boolean(selected) && Boolean(profile)} title="Confirm booking" onClose={() => !booking && setSelected(null)}>
        <p>{selected?.name}</p>
        {profile && (
          <div className="nf-note">
            <p>{profile.full_name}</p>
            <p>{profile.email}</p>
            <p>{profile.address}, {profile.postal_code} {profile.city}</p>
            <p>{profile.country || profile.country_code}</p>
          </div>
        )}
        <label htmlFor="nf-booking-notes">Any questions?</label>
        <input id="nf-booking-notes" value={comments} onChange={(event) => setComments(event.target.value)} />
        <label className="nf-check">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
          <span>I accept the terms and conditions, cancellation policy. An invoice with payment instructions will be generated.</span>
        </label>
        <p className="nf-price">Total: {selected?.price_amount} CHF</p>
        <div className="nf-row">
          <button type="button" className="nf-pill is-quiet" disabled={booking} onClick={() => setSelected(null)}>Cancel</button>
          <button type="button" className="nf-pill border-0" disabled={booking} onClick={confirm}>
            {booking ? 'Generating invoice…' : 'Generate invoice'}
          </button>
        </div>
      </NewDialog>

      <NewProfileDialog
        open={profileOpen}
        onClose={() => { setProfileOpen(false); setSelected(null); }}
        onSaved={(updated) => {
          setProfileOpen(false);
          setProfile(updated);
          setComments('');
          setTermsAccepted(false);
        }}
      />
      <NewInvoiceDialog
        open={Boolean(invoice)}
        bookingId={invoice?.bookingId}
        invoiceUrl={invoice?.invoiceUrl}
        onClose={() => {
          setInvoice(null);
          navigate('/new/payments');
        }}
      />
    </>
  );
};

export default NewAdultsPage;
