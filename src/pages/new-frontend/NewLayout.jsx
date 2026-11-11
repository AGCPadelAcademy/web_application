import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LanguageFlag from './LanguageFlag';
import './new-shell.css';

const NAV = [
  { to: '/new', label: 'Home', end: true },
  { to: '/new/kids', label: 'Kids' },
  { to: '/new/adults', label: 'Adults' },
  { to: '/new/trips', label: 'Trips' },
  { to: '/new/tournaments', label: 'Tournaments' },
  { to: '/new/contact', label: 'Contact' },
];

const LANGUAGES = [
  { code: 'EN', name: 'English' },
  { code: 'ES', name: 'Español' },
  { code: 'DE', name: 'Deutsch' },
  { code: 'FR', name: 'Français' },
  { code: 'IT', name: 'Italiano' },
];

const NewLayout = () => {
  const { pathname } = useLocation();
  const isHome = pathname === '/new';
  const [themeIcon, setThemeIcon] = useState('sun');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [open, setOpen] = useState(false);

  return (
    <div className={`nf ${isHome ? 'nf-home' : ''} flex flex-col flex-grow`}>
      <Helmet>
        <title>AGC Padel Academy — New</title>
        <meta name="description" content="AGC Padel Academy new frontend concept." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>
      <nav className="nf-nav" aria-label="New frontend">
        <Link to="/new" className="nf-brand" onClick={() => setOpen(false)}>
          AGC<small>PADEL ACADEMY</small>
        </Link>
        <div className="nf-links">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="nf-tools">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="nf-icon-btn group h-10 w-10 hover:bg-white/10"
                aria-label={`Language ${language.name}`}
              >
                <span className="inline-flex origin-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
                  <LanguageFlag code={language.code} />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[9.5rem]">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLanguage(lang)}
                  className="gap-2"
                >
                  <LanguageFlag code={lang.code} />
                  <span>{lang.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="nf-icon-btn group h-10 w-10 hover:bg-white/10"
            aria-label={themeIcon === 'sun' ? 'Sun' : 'Moon'}
            onClick={() => setThemeIcon((current) => (current === 'sun' ? 'moon' : 'sun'))}
          >
            <span className="inline-flex origin-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
              {themeIcon === 'sun' ? (
                <Sun key="sun" className="h-4 w-4 animate-in fade-in duration-200" />
              ) : (
                <Moon key="moon" className="h-4 w-4 animate-in fade-in duration-200" />
              )}
            </span>
          </Button>
          <Link to="/new/login" className="nf-cta">Login</Link>
          <button type="button" className="nf-icon-btn nf-hamb" aria-label="Open menu" onClick={() => setOpen((v) => !v)}>
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </nav>
      {open && (
        <div className="nf-mobile">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link to="/new/login" onClick={() => setOpen(false)}>Login</Link>
        </div>
      )}
      <main className="flex-grow">
        <Outlet />
      </main>
      <footer className="nf-foot">
        <div className="nf-foot-grid">
          <div>
            <h3>AGC Padel Academy</h3>
            <p>Riedstrasse 6, 6330 Cham, Switzerland</p>
            <p>+41 79 799 04 58</p>
            <p>info@agc-padelacademy.com</p>
          </div>
          <div>
            <p><Link to="/new">Home</Link></p>
            <p><Link to="/new/kids">Kids Academy</Link></p>
            <p><Link to="/new/adults">Adult Training</Link></p>
            <p><Link to="/new/trips">Trips</Link></p>
            <p><Link to="/new/tournaments">Tournaments</Link></p>
          </div>
          <div>
            <p><Link to="/new/contact">Contact</Link></p>
            <p><Link to="/new/terms">Terms</Link></p>
            <p><Link to="/new/login">Login</Link></p>
            <p><a href="https://www.instagram.com/agc.padelacademy/" target="_blank" rel="noopener noreferrer">Instagram</a></p>
          </div>
        </div>
        <div className="nf-legal">© 2026 AGC Padel Academy · Concept pages, visual only.</div>
      </footer>
    </div>
  );
};

export default NewLayout;
