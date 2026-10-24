import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TOURNAMENTS_ENABLED } from '@/lib/featureFlags';

const REVIEWS = [
  { quote: 'My child looks forward to every class. The group stays fun and the level fits them.', name: 'Laura M.', role: 'Parent' },
  { quote: 'Adult training is clear and adapted. I can see my game improving week by week.', name: 'Daniel K.', role: 'Adult player' },
  { quote: 'The Ebro Delta trip mixed training with a real break. Hotel, transfers, and the group were excellent.', name: 'Sofia R.', role: 'Trip guest' },
];

const TRIP_POINTS = ['Morning training', 'Hotel and welcome dinner', 'Afternoons in the Delta', 'Transfers included'];

const Home2Page = () => {
  return (
    <>
      <Helmet>
        <title>AGC Padel Academy - Home 2</title>
        <meta name="description" content="Welcome to AGC Padel Academy. Learn from the best and travel with us." />
      </Helmet>

      <section className="px-6 py-16 md:py-24 border-b border-gray-800">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2 md:items-end">
          <h1 className="text-4xl md:text-5xl font-bold font-serif text-white">
            Your Padel Academy, Your Community
          </h1>
          <div>
            <p className="text-gray-300 text-lg">
              A place in Switzerland for kids and adults. Train, travel, and stay with the group.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link to="/lessons">
                <Button className="bg-green-500 hover:bg-green-600 text-black font-bold">Book a lesson</Button>
              </Link>
              <Link to="/trips" className="text-sm font-semibold text-green-400 self-center">
                See the trip →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 bg-gray-900/40" aria-label="Customer reviews">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-white">Reviews</h2>
          <div className="mt-6 divide-y divide-gray-800">
            {REVIEWS.map((review) => (
              <p key={review.name} className="py-4 text-gray-300">
                “{review.quote}” <span className="text-white">{review.name}</span>, {review.role}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-serif font-bold text-white">Our services</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-xl font-semibold text-white">Kids Academy</h3>
              <p className="mt-2 text-gray-300">Group classes for children, matched to age and level.</p>
              <Link to="/lessons" className="mt-3 inline-block text-sm font-semibold text-green-400">View lessons →</Link>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-xl font-semibold text-white">Adult Training</h3>
              <p className="mt-2 text-gray-300">Private and group lessons for adults, at your pace.</p>
              <Link to="/lessons" className="mt-3 inline-block text-sm font-semibold text-green-400">View lessons →</Link>
            </div>
            {TOURNAMENTS_ENABLED && (
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-xl font-semibold text-white">Tournaments</h3>
                <p className="mt-2 text-gray-300">The AGC circuit through the year.</p>
                <Link to="/tournaments" className="mt-3 inline-block text-sm font-semibold text-green-400">View tournaments →</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 border-t border-gray-800">
        <div className="max-w-6xl mx-auto md:flex md:items-start md:justify-between md:gap-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-serif font-bold text-white">Padel trips</h2>
            <p className="mt-3 text-gray-300">
              A week at the Ebro Delta. Training, hotel, and time with the group.
            </p>
            <Link to="/trips" className="mt-4 inline-block text-sm font-semibold text-green-400">Discover trips →</Link>
          </div>
          <ul className="mt-6 md:mt-0 space-y-2 text-gray-300">
            {TRIP_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
};

export default Home2Page;
