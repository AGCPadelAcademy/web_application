import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plane, Hotel, Car, Trophy, Ship, Info, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const TripsPage = () => {
  const {
    toast
  } = useToast();
  const navigate = useNavigate(); // Initialize useNavigate

  const handleBookTrip = () => {
    // This function is no longer directly used for the button, but kept for reference
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };
  const itinerary = [{
    day: "1",
    title: "Arrival and Welcome",
    description: "Transfer, hotel check-in and welcome dinner with views of the Delta."
  }, {
    day: "2-6",
    title: "Training and Nature",
    description: "Padel sessions in the morning and activities in the Delta in the afternoon."
  }, {
    day: "7",
    title: "Tournament and Farewell",
    description: "Mini-tournament among participants and closing party."
  }];
  return <>
      <Helmet>
        <title>AGC Padel Academy - Trips to Ebro Delta</title>
        <meta name="description" content="Join our exclusive padel trips to the Ebro Delta. All-inclusive packages with training, hotel and unique activities." />
      </Helmet>
      <div className="px-6 py-12 md:py-24 bg-black">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8
        }} className="text-center mb-16">
            <p className="text-green-400 font-semibold tracking-widest mb-2">UNIQUE EXPERIENCE</p>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white">
              Padel and Paradise in the <span className="text-green-400">Ebro Delta</span>
            </h1>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 items-center mb-24">
            <motion.div initial={{
            opacity: 0,
            scale: 0.95
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            duration: 0.8,
            delay: 0.2
          }} className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl shadow-green-500/10">
              <h2 className="text-3xl font-bold mb-4">Padel Campus Ebro Delta</h2>
              <p className="text-gray-400 text-lg mb-8">A week of intensive training, spectacular nature and local gastronomy.</p>
              
              <div className="grid grid-cols-2 gap-6 text-left mb-8">
                <div className="flex items-center space-x-3"><Trophy className="w-8 h-8 text-green-400" /><div><p className="font-semibold">Training</p><p className="text-sm text-gray-400">Intensive</p></div></div>
                <div className="flex items-center space-x-3"><Hotel className="w-8 h-8 text-green-400" /><div><p className="font-semibold">Accommodation</p><p className="text-sm text-gray-400">Charming</p></div></div>
                <div className="flex items-center space-x-3"><Ship className="w-8 h-8 text-green-400" /><div><p className="font-semibold">Activities</p><p className="text-sm text-gray-400">Exclusive</p></div></div>
                <div className="flex items-center space-x-3"><Car className="w-8 h-8 text-green-400" /><div><p className="font-semibold">Transport</p><p className="text-sm text-gray-400">Included</p></div></div>
              </div>

              <Button onClick={() => navigate('/contact')} // Changed to redirect to /contact
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-xl text-lg">
                Sign up for the Trip
              </Button>
            </motion.div>
            <div className="grid grid-cols-2 gap-4 h-[450px]">
              <div className="col-span-2 rounded-2xl overflow-hidden">
                <img className="w-full h-full object-cover object-center" alt="Aerial view of the Ebro Delta landscape" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/delta-hIX8c.jpg" />
              </div>
              <div className="rounded-2xl overflow-hidden">
                <img className="w-full h-full object-cover object-center" alt="Flamingos in a lagoon in the Ebro Delta" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg" />
              </div>
              <div className="rounded-2xl overflow-hidden">
                <img className="w-full h-full object-cover object-center" alt="Padel players training with a beautiful natural background" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-xiquetys-camp-LKCMQ.jpeg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>;
};
export default TripsPage;