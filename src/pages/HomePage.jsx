import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>AGC Padel Academy - Home</title>
        <meta name="description" content="Welcome to AGC Padel Academy. Learn from the best, compete in our tournaments and travel with us." />
      </Helmet>
      <div className="relative isolate overflow-hidden bg-gray-900">
        <div className="absolute inset-0 -z-10 h-full w-full bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
            <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-green-400 opacity-20 blur-[100px]"></div>
        </div>
        
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl font-serif">
                Your Padel Academy, Your Community
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                At AGC Padel Academy, we create a unique space for kids and adults in Switzerland. Join our great community, improve your game, and live unforgettable experiences.
              </p>
              <div className="mt-10 flex items-center gap-x-6">
                <Link to="/lessons">
                  <Button size="lg" className="bg-green-500 font-bold text-black hover:bg-green-600">Book a lesson</Button>
                </Link>
                <Link to="/tournaments" className="text-sm font-semibold leading-6 text-white">
                  View Tournaments <span aria-hidden="true">→</span>
                </Link>
              </div>
            </motion.div>
          </div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mt-0 lg:mr-0 lg:max-w-none lg:flex-none xl:ml-32"
          >
            <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
              <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
                <img-replace src="https://horizons-cdn.hostinger.com/31db3b70-3837-4417-85cd-c2228d2043cf/foto-grup-la-rapita-camp-gk3WD.jpeg" alt="AGC Padel Academy community group photo" className="w-[76rem] rounded-md shadow-2xl ring-1 ring-gray-900/10" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
       {/* Services Section */}
      <section className="py-24 sm:py-32 bg-black">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-green-400">Our Services</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl font-serif">Everything you need for your padel</p>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              From personalized classes and competitive tournaments to unique padel trips.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-white">Lessons for everyone</dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">Private, group, and kids classes. Adapted to your level so you improve day by day.</p>
                  <p className="mt-6">
                    <Link to="/lessons" className="text-sm font-semibold leading-6 text-green-400">View lessons <span aria-hidden="true">→</span></Link>
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-white">Exciting Tournaments</dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">Compete in the AGC Tournament circuit throughout the year and win incredible prizes.</p>
                  <p className="mt-6">
                    <Link to="/tournaments" className="text-sm font-semibold leading-6 text-green-400">View tournaments <span aria-hidden="true">→</span></Link>
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-white">Padel Trips</dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">Join our camps in Spain. Packages with flights, hotel, transfers, and training.</p>
                  <p className="mt-6">
                    <Link to="/trips" className="text-sm font-semibold leading-6 text-green-400">Discover trips <span aria-hidden="true">→</span></Link>
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
};
export default HomePage;