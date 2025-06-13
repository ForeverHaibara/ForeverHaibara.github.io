
import React from 'react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { name: 'Home', path: '/' },
  { name: 'Triples', path: '/triples' }, // Updated text and path
  { name: 'About', path: '/about' },
  // Add more links as needed e.g. Blog, Projects
];

const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <NavLink to="/" className="text-3xl font-bold tracking-tight hover:opacity-90 transition-opacity">
          ForeverHaibara
        </NavLink>
        <nav className="mt-4 sm:mt-0">
          <ul className="flex space-x-4 sm:space-x-6">
            {navigationItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `text-base font-medium transition-colors hover:text-blue-200 ${
                      isActive ? 'text-blue-100 underline underline-offset-4 decoration-2 decoration-blue-300' : 'text-white'
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
