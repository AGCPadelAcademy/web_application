import React from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Mail, MapPin } from 'lucide-react';

const Footer = () => {
  const {
    toast
  } = useToast();
  const handleSubscribe = e => {
    e.preventDefault();
    toast({
      title: "🚧 Thanks for subscribing!",
      description: "Well, not really. This feature isn't implemented yet! 🚀"
    });
  };
  return <footer className="bg-gray-900/50 border-t border-gray-800 text-gray-400 pt-16 pb-8 px-6 md:px-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div className="md:col-span-1">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-black font-bold text-lg">A</span>
            </div>
            <div>
              <p className="text-xl font-bold text-white">AGC Padel</p>
              <p className="text-sm text-gray-400">Academy</p>
            </div>
          </div>
        <p className="text-sm">Professional padel training for all levels in a modern facility.</p>
        <p className="text-sm mt-4">
          Technical feedback regarding the website only:
          josafesf2@gmail.com
        </p>

        </div>

        <div>
          <p className="font-semibold text-white mb-4">Navigation</p>
          <ul className="space-y-2">
            <li><Link to="/lessons" className="hover:text-green-400 transition-colors">Lessons</Link></li>
            <li><Link to="/trips" className="hover:text-green-400 transition-colors">Trips</Link></li>
            <li><Link to="/tournaments" className="hover:text-green-400 transition-colors">Tournaments</Link></li>
            <li><Link to="/contact" className="hover:text-green-400 transition-colors">Contact</Link></li>
            <li><Link to="/terms" className="hover:text-green-400 transition-colors flex items-center gap-2">Terms & Conditions</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-white mb-4">Contact</p>
          <ul className="space-y-3">
            <li className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 mt-1 text-green-400 flex-shrink-0" />
              <span>Durisolstrasse 3, 5612 Villmergen </span>
            </li>
            <li className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-green-400" />
              <span>+41 76 611 40 61</span>
            </li>
            <li className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-green-400" />
              <span>agcpadelacademy@gmail.com</span>
            </li>
        </ul>
        </div>

        <div>
          <p className="font-semibold text-white mb-4">Newsletter</p>
          <p className="mb-4 text-sm">Subscribe to receive the latest news and offers.</p>
          <form onSubmit={handleSubscribe} className="flex space-x-2">
            <Input type="email" placeholder="Your email" className="bg-gray-800 border-gray-700 text-white" />
            <Button type="submit" className="bg-green-500 hover:bg-green-600 text-black font-bold">
              Go
            </Button>
          </form>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400 space-y-1">
        <p>&copy; {new Date().getFullYear()} AGC Padel Academy. All rights reserved.</p>
        <p className="text-xs">
          Page design & development — Joan Sabater Ferré (external collaborator)
        </p>
      </div>

    </footer>;
};
export default Footer;