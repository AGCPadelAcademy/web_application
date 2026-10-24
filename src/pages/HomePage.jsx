import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TOURNAMENTS_ENABLED } from '@/lib/featureFlags';

const REVIEWS = [
  {
    quote: 'My child looks forward to every class. The group stays fun and the level fits them.',
    name: 'Laura M.',
    role: 'Parent',
  },
  {
    quote: 'Adult training is clear and adapted. I can see my game improving week by week.',
    name: 'Daniel K.',
    role: 'Adult player',
  },
  {
    quote: 'The Ebro Delta trip mixed training with a real break. Hotel, transfers, and the group were excellent.',
    name: 'Sofia R.',
    role: 'Trip guest',
  },
];

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>AGC Padel Academy - Home</title>
        <meta
          name="description"
          content={
            TOURNAMENTS_ENABLED
              ? 'Welcome to AGC Padel Academy. Learn from the best, compete in our tournaments and travel with us.'
              : 'Welcome to AGC Padel Academy. Learn from the best and travel with us.'
          }
        />
      </Helmet>
      <div className="relative isolate overflow-hidden bg-background">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
            <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-green-400 opacity-20 blur-[100px]"></div>
        </div>
        
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-2xl text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl font-serif">
                Your Padel Academy, Your Community
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                At AGC Padel Academy, we create a unique space for kids and adults in Switzerland. Join our great community, improve your game, and live unforgettable experiences.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/lessons">
                  <Button size="lg" className="bg-green-500 font-bold text-black hover:bg-green-600">Book a lesson</Button>
                </Link>
                {TOURNAMENTS_ENABLED && (
                  <Link to="/tournaments" className="text-sm font-semibold leading-6 text-white">
                    View Tournaments <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      <section className="py-24 sm:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-green-400">Our Services</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl font-serif">Kids academy and adult training</p>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Classes for children and adults, adapted to each level.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2">
            <article className="rounded-3xl border border-gray-800 bg-gray-900/50 p-8">
              <h3 className="text-2xl font-semibold text-white font-serif">Kids Academy</h3>
              <p className="mt-4 text-base leading-7 text-gray-300">
                Group classes for children in a friendly setting. The session matches their age and level so they enjoy the court and keep improving.
              </p>
              <p className="mt-6">
                <Link to="/lessons" className="text-sm font-semibold leading-6 text-green-400">View lessons <span aria-hidden="true">→</span></Link>
              </p>
            </article>
            <article className="rounded-3xl border border-gray-800 bg-gray-900/50 p-8">
              <h3 className="text-2xl font-semibold text-white font-serif">Adult Training</h3>
              <p className="mt-4 text-base leading-7 text-gray-300">
                Private and group lessons for adults. Work on your game at your pace, from a first class to regular training.
              </p>
              <p className="mt-6">
                <Link to="/lessons" className="text-sm font-semibold leading-6 text-green-400">View lessons <span aria-hidden="true">→</span></Link>
              </p>
            </article>
            {TOURNAMENTS_ENABLED && (
              <article className="rounded-3xl border border-gray-800 bg-gray-900/50 p-8 lg:col-span-2">
                <h3 className="text-2xl font-semibold text-white font-serif">Exciting Tournaments</h3>
                <p className="mt-4 text-base leading-7 text-gray-300">
                  Compete in the AGC Tournament circuit throughout the year and win incredible prizes.
                </p>
                <p className="mt-6">
                  <Link to="/tournaments" className="text-sm font-semibold leading-6 text-green-400">View tournaments <span aria-hidden="true">→</span></Link>
                </p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-gray-800 bg-gray-900/40 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-green-400">More services</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl font-serif">Padel trips</p>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              A week at the Ebro Delta with training, hotel, transfers, and time on the coast.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:max-w-none lg:grid-cols-4">
            {[
              ['Training', 'Morning padel sessions through the week.'],
              ['Stay', 'Hotel check-in and a welcome dinner.'],
              ['Activities', 'Afternoons in the Delta with the group.'],
              ['Travel', 'Transfers are part of the package.'],
            ].map(([title, text]) => (
              <article key={title} className="rounded-3xl border border-gray-800 bg-background p-6">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-base leading-7 text-gray-300">{text}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-center">
            <Link to="/trips" className="text-sm font-semibold leading-6 text-green-400">Discover trips <span aria-hidden="true">→</span></Link>
          </p>
        </div>
      </section>

      <section className="py-24 sm:py-32 bg-background" aria-label="Customer reviews">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-green-400">Customers</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl font-serif">Reviews</p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
            {REVIEWS.map((review) => (
              <article key={review.name} className="rounded-3xl border border-gray-800 bg-gray-900/50 p-8">
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mt-4 text-base leading-7 text-gray-300">“{review.quote}”</p>
                <p className="mt-6 text-sm font-semibold text-white">{review.name}</p>
                <p className="text-sm text-gray-400">{review.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
export default HomePage;