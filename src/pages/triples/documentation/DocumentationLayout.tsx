import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const docNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
    isActive
      ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_8px_20px_rgba(96,165,250,0.14)]'
      : 'text-slate-600 hover:bg-white/70 hover:text-sky-700'
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
    ]
  },
  {
    name: 'Semidefinite Programming',
    path: '/triples/documentation/semidefinite-programming',
    subLinks: [
      { name: 'SDPSOS', path: '/triples/documentation/semidefinite-programming/sdpsos' },
    ]
  },
];

const DocumentationLayout: React.FC = () => {
  return (
    <div className="flex flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/56 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur-xl md:flex-row">
      <aside className="w-full flex-shrink-0 border-b border-white/60 bg-[linear-gradient(180deg,rgba(248,252,255,0.92),rgba(239,246,255,0.7))] p-4 md:w-72 md:border-b-0 md:border-r md:border-white/60">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Documentation Menu</h2>
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
                <div className="ml-4 mt-2 space-y-1 border-l border-sky-100 pl-4">
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
      <main className="flex-grow overflow-y-auto p-6 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default DocumentationLayout;
