
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, Loader2, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { addMinutes, format, setHours, setMinutes, isValid, startOfDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import ProfileCompletionModal from '@/components/modals/ProfileCompletionModal';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import { isProfileComplete } from '@/lib/ProfileValidation';

const translations = {
  ES: {
    title: "Reserva de Clases",
    subtitle: "Elige fecha, hora y el tipo de clase que prefieras.",
    bookBtn: "Reservar Ahora",
    cancellation: "Cancelación",
    confirmTitle: "Confirmar Reserva",
    confirmDesc: "Completa tus datos y genera la factura.",
    name: "Nombre",
    phone: "Teléfono",
    comments: "¿Alguna consulta?",
    total: "Total",
    cancelBtn: "Cancelar",
    payBtn: "Generar Factura",
    bookError: "Error en la reserva",
    termsAccept: "Acepto los términos y condiciones, política de cancelación",
    paymentInfo: "Se generará una factura con instrucciones de pago.",
    termsError: "Debes aceptar los términos y condiciones para continuar.",
    generatingInvoice: "Generando factura...",
    sectionAdults: "Membresías Adultos",
    sectionSingular: "Sesiones Individuales",
  },
  EN: {
    title: "Lesson Booking",
    subtitle: "Choose date, time, and your preferred lesson type.",
    bookBtn: "Book Now",
    cancellation: "Cancellation",
    confirmTitle: "Confirm Booking",
    confirmDesc: "Fill in your details and generate invoice.",
    name: "Name",
    phone: "Phone",
    comments: "Any questions?",
    total: "Total",
    cancelBtn: "Cancel",
    payBtn: "Generate Invoice",
    bookError: "Booking Error",
    termsAccept: "I accept the terms and conditions, cancellation policy",
    paymentInfo: "An invoice with payment instructions will be generated.",
    termsError: "You must accept the terms and conditions to proceed.",
    generatingInvoice: "Generating invoice...",
    sectionAdults: "Adult Memberships",
    sectionSingular: "Individual Sessions",
  }
};

const createLesson = (id, titles, price, priceId, duration, credits, details, isSingular = false, isKid = false, timeRestriction = null) => {
    return { id, titles, price, priceId, duration, credits, creditExpiry: 6, details, cancellation: "48 h", isSingular, isKid, timeRestriction };
};

const lessonDefinitions = [
    createLesson("sub_morning", 
      { ES: "Afterwork Group (>18:00)", EN: "Afterwork Group (>18:00 PM)" },
        "260", "price_1SfIEG1JMsLDc1io1ylusZS5", 90, 4, 
        { ES: "1 grupo/semana", EN: "1 group/week" }, false, false, null),
    createLesson("sub_morning_light", 
        { ES: "Morning Group (<15:00)", EN: "Morning Group (<15:00)" },
        "240", "price_1SfIEd1JMsLDc1ioQzbvz85r", 90, 4, 
        { ES: "1 grupo/semana", EN: "1 group/week" }, false, false, null),
    createLesson("sub_day_ind_light", 
        { ES: "Individual Diurno – Light (<15:00)", EN: "Daytime Individual – Light (<15:00)" },
        "255", "price_1SfIDk1JMsLDc1ioYj2IgEJV", 60, 2, 
        { ES: "2 clases/mes", EN: "2 lessons/month" }, false, false, null),
    createLesson("single_priv_60", 
        { ES: "Privado 60 min (<15:00)", EN: "Private 60 min (<15:00)" },
        "140", "price_1SfHwo1JMsLDc1ionUd5nC1M", 60, 1, 
        { ES: "1 Sesión privada", EN: "1 Private Session" }, true, false, 'morning'),
];

const LessonsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang] = useState("EN");
  const t = translations[lang];

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [questionnaire, setQuestionnaire] = useState({ comments: '' });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [cachedProfile, setCachedProfile] = useState(null);

  // State management for Invoice Preview Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState('');

  const fetchBookings = useCallback(async () => {
    if (!selectedDate) return;
    setLoadingBookings(true);
    try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('bookings')
          .select('booking_date, start_time, end_time, user_id, payment_status')
          .eq('booking_date', formattedDate)
          .in('payment_status', ['confirmed', 'pending']); 

        if (error) throw error;
        if (data) {
          setBookings(data.map(b => ({ 
                  start: new Date(`${b.booking_date}T${b.start_time}Z`), 
                  end: new Date(`${b.booking_date}T${b.end_time}Z`), 
                  isMine: user?.id === b.user_id 
          })));
        }
    } catch (error) {
        toast({ title: t.bookError, description: "Could not load availability.", variant: "destructive" });
    } finally {
        setLoadingBookings(false);
    }
  }, [user, selectedDate, t, toast]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const isSlotBooked = useCallback((slotDate, duration) => {
    const slotEnd = addMinutes(slotDate, duration);
    for (const booking of bookings) {
      if (slotDate < booking.end && slotEnd > booking.start) {
        return { booked: true, isMine: booking.isMine };
      }
    }
    return { booked: false, isMine: false };
  }, [bookings]);

  const timeSlots = useMemo(() => {
    if (!selectedDate || !isValid(selectedDate)) return [];
    const slots = [];
    let cursor = setMinutes(setHours(startOfDay(selectedDate), 8), 0);
    const endOfBookableTime = setMinutes(setHours(startOfDay(selectedDate), 20), 30); 
    
    while (cursor <= endOfBookableTime) {
      const { booked, isMine } = isSlotBooked(cursor, 30);
      const hour = cursor.getHours();
      const isBlocked = hour === 14;
      slots.push({ date: new Date(cursor), time: format(cursor, 'HH:mm'), booked, isMine, isBlocked });
      cursor = addMinutes(cursor, 30);
    }
    return slots;
  }, [selectedDate, isSlotBooked]);

  const handleBookNow = async (lesson) => {
    if (!user) {
        navigate(`/login?return_to=${encodeURIComponent(`/lessons?product=${lesson.id}`)}`);
        return;
    }
    
    setSelectedLesson(lesson);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!isProfileComplete(profile)) {
        setProfileModalOpen(true);
        return;
    }

    setCachedProfile(profile);
    setTermsAccepted(false);
    setIsConfirmOpen(true);
  };

  const handleProfileSaveSuccess = (updatedProfile) => {
    setProfileModalOpen(false);
    setCachedProfile(updatedProfile);
    setTermsAccepted(false);
    setIsConfirmOpen(true);
  };

  const executeBookingAndInvoice = async (profileData) => {
    setIsBooking(true);
    try {
        // 1. Insert booking record
        const bookingDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
        const bookingData = {
            user_id: user.id,
            lesson_id: selectedLesson.id,
            lesson_name: selectedLesson.titles[lang],
            price: selectedLesson.price + " CHF",
            booking_date: bookingDate,
            start_time: selectedTime ? selectedTime.time : null,
            end_time: selectedTime ? format(addMinutes(selectedTime.date, selectedLesson.duration), 'HH:mm') : null,
            duration_minutes: selectedLesson.duration,
            status: 'pending_payment',
            payment_status: 'pending',
            client_email: profileData.email,
            client_phone: profileData.phone,
            notes: questionnaire.comments,
        };

        const { data: insertedBooking, error: insertError } = await supabase
            .from('bookings').insert(bookingData).select().single();
        if (insertError) throw insertError;

        const booking_id = insertedBooking.id;

        // 2. Edge Function: generate invoice PDF server-side and return public URL
        // invoice_number is generated by the Edge Function (sequential INV-YYYY/MM/DD-XX)
        const { data: efData, error: efError } = await supabase.functions.invoke('generate-invoice-pdf', {
            body: {
                booking_id,
                amount: selectedLesson.price,
                invoice_date: bookingDate,
                customer_fullname: profileData.full_name,
                customer_address: profileData.address,
                customer_postal_city: `${profileData.postal_code} ${profileData.city}`,
                customer_country: profileData.country,
                lesson_name: bookingData.lesson_name,
                qty: 1,
                user_id: user.id,
            },
        });

        if (efError || !efData?.success) {
            throw new Error(efError?.message || efData?.error || 'Invoice generation failed');
        }

        const { url: invoiceUrl, invoice_id } = efData;

        setIsConfirmOpen(false);
        toast({
            title: 'Booking Successful',
            description: 'Your invoice has been generated.',
            variant: 'default',
        });

        setSelectedBookingId(booking_id);
        setSelectedInvoiceUrl(invoiceUrl);
        setIsInvoiceModalOpen(true);

    } catch (error) {
        console.error('Booking error:', error);
        toast({ title: t.bookError, description: error.message, variant: 'destructive' });
    } finally {
        setIsBooking(false);
    }
  };

  const handleConfirmAndPay = () => {
    if (!termsAccepted) {
        toast({ title: "Terms", description: t.termsError, variant: "destructive" });
        return;
    }
    executeBookingAndInvoice(cachedProfile);
  };

  const adultMemberships = lessonDefinitions.filter(l => !l.isSingular && !l.isKid);
  const singularSessions = lessonDefinitions.filter(l => l.isSingular);

  const LessonCard = ({ lesson }) => {
    const localizedTitle = lesson.titles[lang];
    const localizedDetails = lesson.details[lang];
    return (
        <motion.div whileHover={{ scale: 1.03, y: -5 }} className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 flex flex-col h-full">
            <h3 className="text-xl font-bold mb-2 min-h-[3.5rem]">{localizedTitle}</h3>
            <div className="text-4xl font-bold text-green-400 mb-4">{lesson.price} CHF</div>
            <p className="text-gray-400 mb-2 text-sm"><Info className="inline w-4 h-4 mr-2" />{localizedDetails}</p>
            <p className="text-xs text-yellow-400/80 mb-4 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {t.cancellation}: {lesson.cancellation}
            </p>
            <Button onClick={() => handleBookNow(lesson)} className="w-full mt-auto bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                <CalendarIcon size={20}/> {t.bookBtn}
            </Button>
        </motion.div>
    );
  };

  return (
    <>
      <Helmet><title>AGC Padel Academy - {t.title}</title></Helmet>
      <div className="px-6 py-12 md:py-24 relative max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-4">
            <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">{t.title}</h1>
                <p className="text-lg text-gray-400 max-w-3xl mx-auto md:mx-0">{t.subtitle}</p>
            </div>
        </div>

        <section className="mb-24 grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { if(date) { setSelectedDate(date); setSelectedTime(null); } }}
                disabled={(date) => date < startOfDay(new Date())}
                className="w-full"
                classNames={{ day_selected: 'bg-green-500 text-black hover:bg-green-600 focus:bg-green-500', day_today: 'text-green-400' }}
              />
            </div>
            <div className="lg:col-span-1">
              <h3 className="text-2xl font-bold mb-4">{selectedDate && isValid(selectedDate) ? format(selectedDate, 'dd MMMM, yyyy') : '...'}</h3>
              {loadingBookings ? (
                <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-2 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {timeSlots.map(slot => (
                    <Button
                      key={slot.time}
                      variant={selectedTime?.time === slot.time ? 'default' : 'outline'}
                      onClick={() => setSelectedTime(slot)}
                      disabled={slot.booked || slot.isBlocked}
                      className={cn('w-full', 
                          selectedTime?.time === slot.time ? 'bg-green-500 hover:bg-green-600 text-black' : 'border-gray-700 bg-gray-800/50 text-white', 
                          (slot.booked || slot.isBlocked) && 'bg-gray-800/30 border-gray-800 text-gray-600 cursor-not-allowed'
                      )}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
        </section>

        <div className="mb-24">
            <h2 className="text-3xl font-bold font-serif mb-8">{t.sectionAdults}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {adultMemberships.map((lesson, index) => <LessonCard key={index} lesson={lesson} />)}
            </div>
        </div>

        <div className="mb-24">
            <h2 className="text-3xl font-bold font-serif mb-8">{t.sectionSingular}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {singularSessions.map((lesson, index) => <LessonCard key={index} lesson={lesson} />)}
            </div>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white rounded-2xl max-w-lg shadow-lg">
            <>
              <DialogHeader>
                <DialogTitle className="text-green-400 text-2xl">{t.confirmTitle}</DialogTitle>
                <DialogDescription className="text-gray-400">{t.confirmDesc}</DialogDescription>
              </DialogHeader>
              <div className="my-4 space-y-4">
                  <p className="font-semibold text-lg">{selectedLesson?.titles[lang]}</p>
                  
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-2">
                    <p className="text-sm text-gray-400 uppercase tracking-wider">Billing Profile</p>
                    <p className="font-medium">{cachedProfile?.full_name}</p>
                    <p className="text-sm text-gray-300">{cachedProfile?.email}</p>
                    <p className="text-sm text-gray-300">{cachedProfile?.address}, {cachedProfile?.postal_code} {cachedProfile?.city}</p>
                  </div>

                  <div>
                    <Label>{t.comments}</Label>
                    <Input value={questionnaire.comments} onChange={e => setQuestionnaire({comments: e.target.value})} className="bg-gray-800 border-gray-700 mt-1 text-white"/>
                  </div>
                  
                  <div className="flex items-start space-x-2 pt-4 bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
                      <Checkbox id="terms" checked={termsAccepted} onCheckedChange={setTermsAccepted} className="border-gray-500 mt-1" />
                      <div className="grid gap-1.5 leading-none">
                        <label htmlFor="terms" className="text-sm font-medium text-gray-300 cursor-pointer">{t.termsAccept}</label>
                        <p className="text-xs text-gray-500">{t.paymentInfo}</p>
                      </div>
                  </div>
                  <p className="text-2xl font-bold text-green-400 pt-2 text-right">{t.total}: {selectedLesson?.price} CHF</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isBooking} className="text-white border-gray-600 hover:bg-gray-800">
                    {t.cancelBtn}
                </Button>
                <Button onClick={handleConfirmAndPay} className="bg-green-500 hover:bg-green-600 text-black font-bold" disabled={isBooking}>
                    {isBooking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.generatingInvoice}</> : t.payBtn}
                </Button>
              </DialogFooter>
            </>
        </DialogContent>
      </Dialog>

      <ProfileCompletionModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen} 
        onSaveSuccess={handleProfileSaveSuccess}
        onCancel={() => setProfileModalOpen(false)}
      />

      {/* Embedded Invoice Preview Modal */}
      <InvoicePreviewModal 
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          // Redirect the user to payments after closing the modal
          navigate('/payments');
        }}
        bookingId={selectedBookingId}
        invoiceUrl={selectedInvoiceUrl}
      />
    </>
  );
};

export default LessonsPage;
