
import { useState, useEffect } from 'react';
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

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/lessons', label: 'Lessons' },
  { to: '/camps', label: 'Camps' },
  { to: '/trips', label: 'Trips' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact', label: 'Contact' },
];

const Header = () => {
  const { user, signOut, loading, role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      className="sticky top-0 z-50 flex items-center justify-between gap-2 px-4 md:px-10 py-4 bg-black/80 backdrop-blur-sm border-b border-gray-800"
    >
      <Link to="/" className="flex items-center space-x-2 min-w-0">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-black font-bold text-lg">A</span>
        </div>
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
