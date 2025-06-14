
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TriplesLayout: React.FC = () => {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-700 hover:bg-blue-100 hover:text-blue-700'
    }`;

  return (
    <div className="space-y-6">
      <nav className="bg-white p-3 rounded-lg shadow-md">
        <ul className="flex space-x-2 sm:space-x-4">
          <li>
            <NavLink to="/triples" end className={navLinkClasses}>
              Solver
            </NavLink>
          </li>
          <li>
            {/* This NavLink correctly points to the documentation index.
                It will remain active for sub-documentation pages due to not having 'end'. */}
            <NavLink to="/triples/documentation" className={navLinkClasses}>
              Documentation
            </NavLink>
          </li>
        </ul>
      </nav>
      {/* The Outlet here will render TriplesSolverPage or DocumentationLayout */}
      <div className="bg-slate-50 p-1 rounded-xl shadow-sm"> {/* Adjusted shadow for less intensity */}
        <Outlet />
      </div>
    </div>
  );
};

export default TriplesLayout;
