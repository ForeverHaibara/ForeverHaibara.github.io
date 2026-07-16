import React from 'react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { name: 'Home', path: '/' },
  { name: 'Triples', path: '/triples' },
  { name: 'Geometry', path: '/geometry' },
  { name: 'GeoGebra', path: '/geogebra' },
  { name: 'About', path: '/about' },
];

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-[rgba(244,249,255,0.72)] text-slate-800 shadow-[0_10px_30px_rgba(148,163,184,0.12)] backdrop-blur-xl">
      <div className="flex max-w-6xl flex-col items-start justify-between px-4 py-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <NavLink
          to="/"
          className="text-3xl font-semibold tracking-[-0.04em] text-slate-800 transition-all duration-300 hover:text-sky-700"
        >
          ForeverHaibara
        </NavLink>
        <nav className="mt-4 sm:mt-0">
          <ul className="flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            {navigationItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
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
