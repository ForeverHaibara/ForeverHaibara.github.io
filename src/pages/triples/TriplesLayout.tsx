import React from 'react';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import '../../styles/showcase.css';

const TriplesLayout: React.FC = () => {
  const isSolver = useMatch({ path: '/triples', end: true });
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `triples-navigation-link${isActive ? ' is-active' : ''}`;

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
        <nav aria-label="Triples" className="triples-navigation">
          <ul>
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
        <div className={`min-w-0 w-full mx-auto ${isSolver ? 'max-w-[1240px]' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default TriplesLayout;
