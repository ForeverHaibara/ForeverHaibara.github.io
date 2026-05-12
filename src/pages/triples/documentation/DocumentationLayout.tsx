
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const docNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
    isActive
      ? 'bg-blue-100 text-blue-700 font-semibold'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
  }`;

const documentationSections = [
  { name: 'Overview', path: '/triples/documentation', end: true },
  { name: 'Getting Started', path: '/triples/documentation/getting-started' },
  { name: 'Applications', path: '/triples/documentation/applications',
    subLinks: [
      { name: 'Limitations', path: '/triples/documentation/applications/limitations' },
    ]
  },
  { 
    name: 'API Reference', 
    path: '/triples/documentation/api-reference',
    subLinks: [
      { name: 'Sum of Squares', path: '/triples/documentation/api-reference/sum-of-squares' },
      { name: 'SymPy', path: '/triples/documentation/api-reference/sympy' },
      // Add more API sub-links here
    ]
  },
  {
    name: 'Semidefinite Programming',
    path: '/triples/documentation/semidefinite-programming',
    subLinks: [
      { name: 'SDPSOS', path: '/triples/documentation/semidefinite-programming/sdpsos' },
    ]
  },
  // Add more top-level sections here
];

const DocumentationLayout: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row bg-white rounded-xl shadow-xl overflow-hidden">
      <aside className="w-full md:w-64 bg-slate-50 p-4 border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Documentation Menu</h2>
        <nav className="space-y-1">
          {documentationSections.map((section) => (
            <div key={section.name}>
              <NavLink
                to={section.path}
                end={section.end}
                className={docNavLinkClasses}
              >
                {section.name}
              </NavLink>
              {section.subLinks && (
                <div className="pl-4 mt-1 space-y-1 border-l border-slate-300 ml-3">
                  {section.subLinks.map(subLink => (
                     <NavLink
                        key={subLink.name}
                        to={subLink.path}
                        className={docNavLinkClasses}
                      >
                       {subLink.name}
                     </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-grow p-6 sm:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DocumentationLayout;
