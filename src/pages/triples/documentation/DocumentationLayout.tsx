import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const docNavLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
    isActive
      ? 'bg-[linear-gradient(135deg,#dbeafe_0%,#eff6ff_100%)] text-sky-800 shadow-[0_8px_20px_rgba(96,165,250,0.14)]'
      : 'text-slate-600 hover:bg-white/70 hover:text-sky-700'
  }`;

const documentationSections = [
  { name: 'Overview', path: '/triples/documentation', end: true },
  { name: 'Getting Started', path: '/triples/documentation/getting-started' },
  {
    name: 'Applications',
    path: '/triples/documentation/applications',
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
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[28px] border border-white/70 bg-white/58 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl">
          <h2 className="mb-4 px-2 text-lg font-semibold text-slate-800">Documentation Menu</h2>
          <nav className="space-y-1">
            {documentationSections.map((section) => (
              <div key={section.name}>
                <NavLink to={section.path} end={section.end} className={docNavLinkClasses}>
                  {section.name}
                </NavLink>
                {section.subLinks && (
                  <div className="ml-4 mt-2 space-y-1 border-l border-sky-100 pl-4">
                    {section.subLinks.map((subLink) => (
                      <NavLink key={subLink.name} to={subLink.path} className={docNavLinkClasses}>
                        {subLink.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0">
        <div className="rounded-[30px] border border-white/70 bg-white/62 px-5 py-6 shadow-[0_20px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl sm:px-7 sm:py-8 xl:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DocumentationLayout;
