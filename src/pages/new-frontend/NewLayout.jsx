import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, User } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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

const placeOverlayThumb = (thumb, setShown) => {
  const scroller = document.scrollingElement || document.documentElement;
  const scrollHeight = scroller.scrollHeight;
  const clientHeight = scroller.clientHeight;
  const overflows = scrollHeight > clientHeight + 1;
  setShown((current) => (current === overflows ? current : overflows));
  if (!thumb || !overflows) return;
  const thumbHeight = Math.max(36, (clientHeight / scrollHeight) * clientHeight);
  const maxScroll = scrollHeight - clientHeight;
  const travel = Math.max(clientHeight - thumbHeight, 0);
  const top = maxScroll > 0 ? (scroller.scrollTop / maxScroll) * travel : 0;
  thumb.style.height = `${thumbHeight}px`;
  thumb.style.transform = `translateY(${top}px)`;
};

const OverlayScrollbar = () => {
  const thumbRef = useRef(null);
  const [shown, setShown] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('nf-overlay');
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => placeOverlayThumb(thumbRef.current, setShown));
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    if (document.body) observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove('nf-overlay');
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [pathname]);

  useLayoutEffect(() => {
    placeOverlayThumb(thumbRef.current, setShown);
  }, [shown, pathname]);

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const thumb = thumbRef.current;
    const scroller = document.scrollingElement || document.documentElement;
    if (!thumb) return;
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startScroll = scroller.scrollTop;
    const thumbHeight = thumb.getBoundingClientRect().height;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const travel = Math.max(scroller.clientHeight - thumbHeight, 1);
    const move = (pointerEvent) => {
      const next = startScroll + ((pointerEvent.clientY - startY) / travel) * maxScroll;
      scroller.scrollTop = Math.min(Math.max(next, 0), maxScroll);
    };
    const end = () => {
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', end);
      thumb.removeEventListener('pointercancel', end);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', end);
    thumb.addEventListener('pointercancel', end);
  };

  return (
    <div className={shown ? 'nf-overlay-bar' : 'nf-overlay-bar is-off'} aria-hidden="true">
      <div ref={thumbRef} className="nf-overlay-thumb" onPointerDown={onPointerDown} />
    </div>
  );
};

const AccountLinks = ({ onNavigate, className }) => {
  const { user, profile, role, signOut } = useAuth();
  if (!user) {
    return <Link to="/new/login" className={className} onClick={onNavigate}>Login</Link>;
  }
  const first = profile?.full_name?.split(' ')[0] || 'there';
  return (
    <>
      <p className="nf-account-hello">Hello, {first}</p>
      <Link to="/new/profile" className={className} onClick={onNavigate}>My Profile</Link>
      <Link to="/new/children" className={className} onClick={onNavigate}>My Children</Link>
      <Link to="/new/payments" className={className} onClick={onNavigate}>My Payments</Link>
      {role === 'coach' && <Link to="/new/coach/roster" className={className} onClick={onNavigate}>Session roster</Link>}
      {role === 'admin' && <Link to="/new/admin" className={className} onClick={onNavigate}>Admin</Link>}
      <button type="button" className="nf-text-btn" onClick={() => { onNavigate?.(); signOut(); }}>Sign Out</button>
    </>
  );
};

const NewLayout = () => {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const isHome = pathname === '/new';
  const [themeIcon, setThemeIcon] = useState('sun');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className={`nf ${isHome ? 'nf-home' : 'nf-inner'} flex flex-col flex-grow`}>
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
          {loading ? null : user ? (
            <div className="nf-account">
              <button
                type="button"
                className="nf-icon-btn"
                aria-label="Open profile menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((current) => !current)}
              >
                <User className="h-4 w-4" />
              </button>
              {accountOpen && (
                <div className="nf-account-menu">
                  <AccountLinks onNavigate={() => setAccountOpen(false)} />
                </div>
              )}
            </div>
          ) : (
            <Link to="/new/login" className="nf-cta">Login</Link>
          )}
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
          <AccountLinks className={undefined} onNavigate={() => setOpen(false)} />
        </div>
      )}
      <main className="flex-grow">
        <Outlet />
      </main>
      <footer className="nf-foot">
        <div className="nf-foot-grid">
          <div>
            <h3>AGC Padel Academy</h3>
            <p>Durisolstrasse 3, 5612 Villmergen, Switzerland</p>
            <p>+41 76 611 40 61</p>
            <p>agcpadelacademy@gmail.com</p>
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
        <div className="nf-legal">© {new Date().getFullYear()} AGC Padel Academy. All rights reserved.</div>
      </footer>
      <OverlayScrollbar />
    </div>
  );
};

export default NewLayout;
