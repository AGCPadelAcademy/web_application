
import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, User, Loader2, Settings, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AuthDialog from '@/components/auth/AuthDialog';
import { supabase } from '@/lib/customSupabaseClient';

const Header = () => {
  const { toast } = useToast();
  const { user, signOut, loading } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [user]);

  const navLinkClasses = "hover:text-green-400 transition-colors";
  const activeNavLinkClasses = "text-green-400";

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-black/80 backdrop-blur-sm border-b border-gray-800"
    >
      <Link to="/" className="flex items-center space-x-2">
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-black font-bold text-lg">A</span>
        </div>
        <div>
          <p className="text-xl font-bold text-white">AGC Padel</p>
          <p className="text-sm text-gray-400">Academy</p>
        </div>
      </Link>

      <nav className="hidden md:flex items-center space-x-8 font-medium">
        <NavLink to="/" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`} end>Home</NavLink>
        <NavLink to="/lessons" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`}>Lessons</NavLink>
        <NavLink to="/trips" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`}>Trips</NavLink>
        <NavLink to="/tournaments" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`}>Tournaments</NavLink>
        <NavLink to="/contact" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : 'text-gray-300'}`}>Contact</NavLink>
      </nav>

      <div className="flex items-center space-x-4">
        <Link to="/lessons">
          <Button className="bg-green-500 hover:bg-green-600 text-black font-bold px-6 py-2 rounded-lg">
            Book Now
          </Button>
        </Link>
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-green-500" />
        ) : user && profile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full w-10 h-10 p-0 border-gray-600 text-white">
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

              <Link to="/payments">
                <DropdownMenuItem className="cursor-pointer focus:bg-gray-800">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>My Payments</span>
                </DropdownMenuItem>
              </Link>

              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <AuthDialog />
        )}
      </div>
    </motion.header>
  );
};

export default Header;
