import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
const TournamentsPage = () => {
  const imageVariants = {
    hidden: {
      opacity: 0,
      scale: 0.9
    },
    visible: i => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.3 + i * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    })
  };
  return <>
      <Helmet>
        <title>AGC Padel Academy - Tournaments</title>
        <meta name="description" content="Information about upcoming AGC Padel Academy tournaments and photo gallery." />
      </Helmet>
      <div className="px-6 py-12 md:py-24 bg-black min-h-screen">
        <div className="max-w-5xl mx-auto">
          
          {/* Info Box */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8
        }} className="max-w-3xl mx-auto bg-gray-900/50 border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl shadow-green-500/10 flex flex-col items-center text-center mb-16">
            <Calendar className="w-16 h-16 text-green-400 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold font-serif mb-4 text-white">
              Upcoming Tournaments
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              Next tournament date: To be confirmed. Tournaments are played in one day with a golden point tiebreak and one set with a minimum of 4 matches.
            </p>
          </motion.div>

          {/* Image Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image 1 */}
            <motion.div custom={0} initial="hidden" animate="visible" variants={imageVariants} className="group relative h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-800 shadow-lg">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10" />
              <img className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" alt="Padel tournament winners holding trophies" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-torneo-agc-MZ4y0.jpg" />
            </motion.div>

            {/* Image 2 */}
            <motion.div custom={1} initial="hidden" animate="visible" variants={imageVariants} className="group relative h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-800 shadow-lg">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10" />
              <img className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" alt="Players shaking hands after a match" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-torneo-agc-gent-caminan-4mm1N.jpg" />
            </motion.div>

            {/* Image 3 */}
            <motion.div custom={2} initial="hidden" animate="visible" variants={imageVariants} className="group relative h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-800 shadow-lg">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10" />
              <img className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" alt="Group photo of tournament participants" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/roman-torneig-agc-48NuE.jpg" />
            </motion.div>

            {/* Image 4 */}
            <motion.div custom={3} initial="hidden" animate="visible" variants={imageVariants} className="group relative h-64 md:h-80 rounded-2xl overflow-hidden border border-gray-800 shadow-lg">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10" />
              <img className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" alt="Close up of padel racket and ball on court" src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/martin-torneig-agc-0HdjX.jpg" />
            </motion.div>
          </div>

        </div>
      </div>
    </>;
};
export default TournamentsPage;