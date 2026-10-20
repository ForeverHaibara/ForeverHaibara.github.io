import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { usePageEntrance } from '../../../components/PageVisuals';
import '../../../styles/showcase.css';

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
    subLinks: [{ name: 'Limitations', path: '/triples/documentation/applications/limitations' }],
  },
  {
    name: 'API Reference',
    path: '/triples/documentation/api-reference',
    subLinks: [
      { name: 'Sum of Squares', path: '/triples/documentation/api-reference/sum-of-squares' },
      { name: 'SymPy', path: '/triples/documentation/api-reference/sympy' },
    ],
  },
  {
    name: 'Solvers',
    path: '/triples/documentation/solvers',
    subLinks: [
      { name: 'StructuralSOS', path: '/triples/documentation/solvers/structsos' },
      { name: 'LinearSOS', path: '/triples/documentation/solvers/linsos' },
      { name: 'SDPSOS', path: '/triples/documentation/solvers/sdpsos' },
    ],
  },
  {
    name: 'Semidefinite Programming',
    path: '/triples/documentation/semidefinite-programming',
    subLinks: [
      { name: 'SDPSOS', path: '/triples/documentation/semidefinite-programming/sdpsos' },
      { name: 'SDPProblem', path: '/triples/documentation/semidefinite-programming/sdp-problem' },
    ],
  },
  {
    name: 'Objects',
    path: '/triples/documentation/objects',
    subLinks: [
      { name: 'Problem', path: '/triples/documentation/objects/problem' },
      { name: 'Solution', path: '/triples/documentation/objects/solution' },
      { name: 'CyclicSum', path: '/triples/documentation/objects/cyclic-sum' },
    ],
  },
];

const DocumentationLayout: React.FC = () => {
  usePageEntrance();
  const [isContentsOpen, setIsContentsOpen] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  );

  const handleNavigate = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) setIsContentsOpen(false);
  };

  return (
    <div className="documentation-layout" data-contents-open={isContentsOpen}>
      <div className="documentation-toolbar">
        <p className="eyebrow">TRIPLES / DOCUMENTATION</p>
        <button
          type="button"
          className="documentation-toggle"
          aria-expanded={isContentsOpen}
          aria-controls="documentation-contents"
          onClick={() => setIsContentsOpen((open) => !open)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
          </svg>
          {isContentsOpen ? 'Hide contents' : 'Show contents'}
        </button>
      </div>
      <aside id="documentation-contents" className="documentation-sidebar" hidden={!isContentsOpen}>
        <div className="documentation-contents-card">
          <h2>Contents</h2>
          <nav aria-label="Documentation contents" className="space-y-1">
            {documentationSections.map((section) => (
              <div key={section.name}>
                <NavLink
                  to={section.path}
                  end
                  className={docNavLinkClasses}
                  onClick={handleNavigate}
                >
                  {section.name}
                </NavLink>
                {section.subLinks && (
                  <div className="ml-3 mt-1 space-y-1 border-l border-sky-100 pl-3">
                    {section.subLinks.map((subLink) => (
                      <NavLink
                        key={subLink.name}
                        to={subLink.path}
                        end
                        className={docNavLinkClasses}
                        onClick={handleNavigate}
                      >
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
      <div className="documentation-body">
        <div
          className="rounded-[24px] border border-white/70 px-5 py-6 shadow-[0_20px_50px_rgba(148,163,184,0.10)] backdrop-blur-xl sm:px-7 sm:py-8 xl:px-9"
          style={{
            background:
              'linear-gradient(180deg, rgba(219,234,254,0.72) 0px, rgba(239,246,255,0.78) 150px, rgba(251,253,255,0.94) 280px, rgba(251,253,255,0.94) 100%)',
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DocumentationLayout;
