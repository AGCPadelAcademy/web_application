
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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
import { buildBookingPayload, createBooking, requestInvoice } from '@/lib/bookings';
import { fetchProfile } from '@/lib/profileService';
import { useNavigate } from 'react-router-dom';
import ProfileCompletionModal from '@/components/modals/ProfileCompletionModal';
import InvoicePreviewModal from '@/components/modals/InvoicePreviewModal.jsx';
import { isProfileComplete } from '@/lib/profileValidation';

const translations = {
  ES: {
    title: "Reserva de Clases",
    subtitle: "Elige el tipo de clase que prefieras. La academia asignará tu grupo.",
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
    subtitle: "Choose your preferred lesson type. The academy assigns your class.",
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

const LessonsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lang] = useState("EN");
  const t = translations[lang];

  const [isBooking, setIsBooking] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [questionnaire, setQuestionnaire] = useState({ comments: '' });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [cachedProfile, setCachedProfile] = useState(null);

  const [lessonDefinitions, setLessonDefinitions] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);

  useEffect(() => {
    supabase
      .from('lessons')
      .select('*')
      .eq('is_active', true)
      .order('price_amount', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setLessonDefinitions(data);
        setLoadingLessons(false);
      });
  }, []);

  // State management for Invoice Preview Modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedInvoiceUrl, setSelectedInvoiceUrl] = useState('');

  const handleBookNow = async (lesson) => {
    if (!user) {
        navigate(`/login?return_to=${encodeURIComponent(`/lessons?product=${lesson.lesson_code}`)}`);
        return;
    }
    
    setSelectedLesson(lesson);

    const profile = await fetchProfile(user.id);
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
        // 1. Insert booking record (no self-serve date/slot; academy assigns class)
        const insertedBooking = await createBooking(buildBookingPayload({
            userId: user.id,
            lesson: selectedLesson,
            bookingDate: null,
            selectedTime: null,
            profile: profileData,
            comments: questionnaire.comments,
        }));

        // 2. Invoice: Bexio when enabled, otherwise legacy PDF.
        // FR-030: a billing failure must not present as a failed booking —
        // the reservation is already created.
        setIsConfirmOpen(false);
        setSelectedBookingId(insertedBooking.id);
        try {
            const efData = await requestInvoice({
                booking: insertedBooking,
                lesson: selectedLesson,
                profile: profileData,
                userId: user.id,
            });
            const { url: invoiceUrl } = efData;
            toast({
                title: 'Booking Successful',
                description: 'Your invoice has been generated and emailed. Scan the QR code to pay.',
                variant: 'default',
            });
            setSelectedInvoiceUrl(invoiceUrl || null);
            setIsInvoiceModalOpen(true);
        } catch (invoiceError) {
            console.error('Invoice error:', invoiceError);
            toast({
                title: 'Booking Successful',
                description: 'Your lesson is booked. The invoice could not be issued yet and will be retried.',
                variant: 'default',
            });
        }

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

  const subscriptionLessons = lessonDefinitions.filter(l => l.is_subscription);
  const singleSessions      = lessonDefinitions.filter(l => !l.is_subscription);

  const LessonCard = ({ lesson }) => (
    <motion.div whileHover={{ scale: 1.03, y: -5 }} className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 flex flex-col h-full">
        <h3 className="text-xl font-bold mb-2 min-h-[3.5rem]">{lesson.name}</h3>
        <div className="text-4xl font-bold text-green-400 mb-4">{lesson.price_amount} CHF</div>
        <p className="text-gray-400 mb-2 text-sm"><Info className="inline w-4 h-4 mr-2" />{lesson.description}</p>
        <p className="text-xs text-yellow-400/80 mb-4 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {t.cancellation}: 48 h
        </p>
        <Button onClick={() => handleBookNow(lesson)} className="w-full mt-auto bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle2 size={20}/> {t.bookBtn}
        </Button>
    </motion.div>
  );

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

        {loadingLessons ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-green-500" />
          </div>
        ) : (
          <>
            {subscriptionLessons.length > 0 && (
              <div className="mb-24">
                <h2 className="text-3xl font-bold font-serif mb-8">{t.sectionAdults}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {subscriptionLessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}
                </div>
              </div>
            )}
            {singleSessions.length > 0 && (
              <div className="mb-24">
                <h2 className="text-3xl font-bold font-serif mb-8">{t.sectionSingular}</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {singleSessions.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white rounded-2xl max-w-lg shadow-lg">
            <>
              <DialogHeader>
                <DialogTitle className="text-green-400 text-2xl">{t.confirmTitle}</DialogTitle>
                <DialogDescription className="text-gray-400">{t.confirmDesc}</DialogDescription>
              </DialogHeader>
              <div className="my-4 space-y-4">
                  <p className="font-semibold text-lg">{selectedLesson?.name}</p>
                  
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-2">
                    <p className="text-sm text-gray-400 uppercase tracking-wider">Billing Profile</p>
                    <p className="font-medium">{cachedProfile?.full_name}</p>
                    <p className="text-sm text-gray-300">{cachedProfile?.email}</p>
                    <p className="text-sm text-gray-300">{cachedProfile?.address}, {cachedProfile?.postal_code} {cachedProfile?.city}</p>
                    <p className="text-sm text-gray-300">{cachedProfile?.country || cachedProfile?.country_code}</p>
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
                  <p className="text-2xl font-bold text-green-400 pt-2 text-right">{t.total}: {selectedLesson?.price_amount} CHF</p>
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
