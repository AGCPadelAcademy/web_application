
import { useState, useEffect, useId } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogOut,
  User,
  Loader2,
  Settings,
  CreditCard,
  ClipboardList,
  SlidersHorizontal,
  Users,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { publicNavLinks } from '@/lib/featureFlags';

const NAV_LINKS = publicNavLinks([
  { to: '/', label: 'Home', end: true },
  { to: '/lessons', label: 'Lessons' },
  { to: '/camps', label: 'Camps' },
  { to: '/trips', label: 'Trips' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact', label: 'Contact' },
]);

const LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'ES', label: 'Español' },
  { code: 'DE', label: 'Deutsch' },
];

const LanguageFlag = ({ code }) => {
  const clipId = useId();
  if (code === 'ES') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#c60b1e" />
        <rect y="4" width="24" height="8" fill="#ffc400" />
      </svg>
    );
  }
  if (code === 'DE') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ffce00" />
        <rect width="24" height="10.67" fill="#dd0000" />
        <rect width="24" height="5.33" fill="#000" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" className="w-6 h-4 rounded-sm" aria-hidden="true">
      <clipPath id={clipId}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
};

const Header = () => {
  const { user, signOut, loading, role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [themeIcon, setThemeIcon] = useState('sun');

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        // Own-row SELECT only — public profiles SELECT was dropped in F1.02.
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = (event) => {
      if (event.matches) setMobileNavOpen(false);
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  const navLinkClasses = "hover:text-green-400 transition-colors";
  const activeNavLinkClasses = "text-green-400";
  const navClassName = ({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`;

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 md:px-10 py-4 bg-background/80 backdrop-blur-sm border-b border-gray-800"
    >
      <Link to="/" className="flex items-center gap-1 min-w-0">
        <img
          src="/logo.png"
          alt=""
          className="w-14 h-14 md:w-16 md:h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div>
          <p className="text-xl font-bold text-white">AGC Padel</p>
          <p className="text-sm text-gray-400">Academy</p>
        </div>
      </Link>

      <nav className="hidden md:flex items-center space-x-8 font-medium" aria-label="Main">
        {NAV_LINKS.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={navClassName}>{label}</NavLink>
        ))}
      </nav>

      <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
        <Link to="/lessons">
          <Button className="bg-green-500 hover:bg-green-600 text-black font-bold px-3 md:px-6 py-2 rounded-lg">
            Book Now
          </Button>
        </Link>
        {/* Visual only. Choosing a language does not translate the site. The theme button only swaps its icon. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 text-white w-11 h-10 p-0"
              aria-label="Language, English"
            >
              <LanguageFlag code="EN" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-900 border-gray-700 text-white min-w-[4.5rem]" align="end">
            {LANGUAGES.map(({ code, label }) => (
              <DropdownMenuItem key={code} className="focus:bg-gray-800 justify-center" aria-label={label}>
                <LanguageFlag code={code} />
                <span className="sr-only">{label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          className="border-gray-600 hover:bg-gray-800 text-white w-10 h-10 p-0"
          aria-label={themeIcon === 'sun' ? 'Sun' : 'Moon'}
          onClick={() => setThemeIcon((current) => (current === 'sun' ? 'moon' : 'sun'))}
        >
          {themeIcon === 'sun' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-green-500" />
        ) : user && profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full w-10 h-10 p-0 border-gray-600 text-white" aria-label="Open profile menu">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-900 border-gray-700 text-white w-56" align="end">
              <DropdownMenuItem disabled className="text-gray-400 font-medium">
                Hello, {profile.full_name?.split(' ')[0] || 'User'}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              
              <Link to="/profile">
                <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
              </Link>

              <Link to="/children">
                <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                  <Users className="mr-2 h-4 w-4" />
                  <span>My Children</span>
                </DropdownMenuItem>
              </Link>

              <Link to="/payments">
                <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>My Payments</span>
                </DropdownMenuItem>
              </Link>

              {role === 'coach' && (
                <Link to="/coach/roster">
                  <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    <span>Session roster</span>
                  </DropdownMenuItem>
                </Link>
              )}

              {role === 'admin' && (
                <Link to="/admin/integrations">
                  <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    <span>Admin</span>
                  </DropdownMenuItem>
                </Link>
              )}

              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link to="/login">
            <Button variant="outline" className="border-gray-600 hover:bg-gray-800 text-white px-3 md:px-4">
              Login
            </Button>
          </Link>
        )}

        <DropdownMenu open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="md:hidden rounded-full w-10 h-10 p-0 border-gray-600 text-white"
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              <Menu className="w-5 h-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-900 border-gray-700 text-white w-56 md:hidden" align="end">
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to}>
                <DropdownMenuItem className="cursor-pointer focus:bg-gray-800 font-medium py-2.5">
                  {label}
                </DropdownMenuItem>
              </Link>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
};

export default Header;
