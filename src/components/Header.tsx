import React from 'react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { name: 'Home', path: '/' },
  { name: 'Triples', path: '/triples' },
  { name: 'Geometry', path: '/geometry' },
  { name: 'GeoGebra', path: '/geogebra' },
  { name: 'Blog', path: '/blog' },
  { name: 'About', path: '/about' },
];

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-[rgba(244,249,255,0.72)] text-slate-800 shadow-[0_10px_30px_rgba(148,163,184,0.12)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <NavLink
          to="/"
          className="text-3xl font-semibold tracking-[-0.04em] text-slate-800 transition-all duration-300 hover:text-sky-700"
        >
          ForeverHaibara
        </NavLink>
        <nav aria-label="Main navigation" className="w-full lg:w-auto">
          <ul className="grid grid-cols-3 items-center gap-1 rounded-3xl border border-white/60 bg-white/55 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:flex sm:flex-wrap sm:justify-center sm:gap-2 sm:rounded-full">
            {navigationItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 w-full items-center justify-center rounded-full px-1 py-2 text-base font-medium transition-all duration-300 sm:px-4 ${
                      isActive
                        ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_8px_20px_rgba(96,165,250,0.18)]'
                        : 'text-slate-600 hover:bg-white/80 hover:text-sky-700'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
