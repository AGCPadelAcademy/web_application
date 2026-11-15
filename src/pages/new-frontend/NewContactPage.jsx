import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import NewMasthead from './NewMasthead';

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '' };

const NewContactPage = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(EMPTY);
  const [sending, setSending] = useState(false);

  const onChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('submit-contact-form', { body: formData });
      if (error) throw error;
      toast({ title: 'Message sent', description: 'Thank you for contacting us. We have received your message successfully.' });
      setFormData(EMPTY);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'There was a problem sending your message. Please try again.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>AGC Padel Academy — Contact</title>
      </Helmet>
      <NewMasthead
        title="Contact"
        lead="Send a message to the academy. Name, email, phone, subject, and message are required."
      />
      <section className="nf-page">
        <div className="nf-grid nf-grid-2">
          <form className="nf-card nf-form" onSubmit={onSubmit}>
            <label htmlFor="nf-name">Name</label>
            <input id="nf-name" name="name" autoComplete="name" required value={formData.name} onChange={onChange} />
            <label htmlFor="nf-email">Email</label>
            <input id="nf-email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={onChange} />
            <label htmlFor="nf-phone">Phone</label>
            <input id="nf-phone" name="phone" type="tel" autoComplete="tel" required value={formData.phone} onChange={onChange} />
            <label htmlFor="nf-subject">Subject</label>
            <input id="nf-subject" name="subject" required value={formData.subject} onChange={onChange} />
            <label htmlFor="nf-message">Message</label>
            <textarea id="nf-message" name="message" required value={formData.message} onChange={onChange} />
            <button type="submit" className="nf-pill border-0" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button>
          </form>
          <article className="nf-card">
            <h3>Visit</h3>
            <p>Durisolstrasse 3, 5612 Villmergen</p>
            <p>+41 76 611 40 61</p>
            <p>agcpadelacademy@gmail.com</p>
            <p>
              <a href="https://www.instagram.com/agc.padelacademy/" target="_blank" rel="noopener noreferrer">Instagram</a>
            </p>
          </article>
        </div>
      </section>
    </>
  );
};

export default NewContactPage;
