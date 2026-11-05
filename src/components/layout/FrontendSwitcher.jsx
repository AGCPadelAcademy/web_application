import { Link, useLocation } from 'react-router-dom';

const FrontendSwitcher = () => {
  const { pathname } = useLocation();
  const isNew = pathname === '/new' || pathname.startsWith('/new/');

  return (
    <nav
      aria-label="Frontend"
      className="sticky top-0 z-[60] h-7 flex items-center justify-center gap-4 bg-gray-950 text-[11px] leading-none border-b border-gray-800"
    >
      <Link to="/" className={`px-2 py-0.5 ${isNew ? 'text-gray-400 hover:text-white' : 'text-green-400'}`}>
        Main
      </Link>
      <Link to="/new" className={`px-2 py-0.5 ${isNew ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}>
        New
      </Link>
    </nav>
  );
};

export default FrontendSwitcher;
