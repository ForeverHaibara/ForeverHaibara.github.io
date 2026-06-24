import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const GeometryLayout: React.FC = () => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
      isActive
        ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_10px_24px_rgba(96,165,250,0.18)]'
        : 'text-slate-600 hover:bg-white/90 hover:text-sky-700'
    }`;

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <nav className="rounded-[26px] border border-white/70 bg-white/58 p-3 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl">
          <ul className="flex flex-wrap gap-2">
            <li>
              <NavLink to="/geometry" end className={navLinkClasses}>
                Pure Geometry Tieba Search
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default GeometryLayout;
