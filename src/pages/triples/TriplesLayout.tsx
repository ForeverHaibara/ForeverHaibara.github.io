import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TriplesLayout: React.FC = () => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_10px_24px_rgba(96,165,250,0.18)]'
        : 'text-slate-600 hover:bg-white/90 hover:text-sky-700'
    }`;

  return (
    <div className="space-y-6">
      <nav className="rounded-[26px] border border-white/70 bg-white/58 p-3 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl">
        <ul className="flex flex-wrap gap-2">
          <li>
            <NavLink to="/triples" end className={navLinkClasses}>
              Solver
            </NavLink>
          </li>
          <li>
            <NavLink to="/triples/documentation" className={navLinkClasses}>
              Documentation
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="rounded-[30px] border border-white/65 bg-white/42 p-1 shadow-[0_22px_50px_rgba(148,163,184,0.14)] backdrop-blur-xl">
        <Outlet />
      </div>
    </div>
  );
};

export default TriplesLayout;
