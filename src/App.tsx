import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import TriplesLayout from './pages/triples/TriplesLayout.tsx';
import TriplesSolverPage from './pages/triples/TriplesSolverPage.tsx';
import DocumentationLayout from './pages/triples/documentation/DocumentationLayout.tsx';
import TriplesDocumentationIndexPage from './pages/triples/documentation/TriplesDocumentationIndexPage.tsx';
import DynamicDocPage from './pages/triples/documentation/DynamicDocPage.tsx';
import GeometryLayout from './pages/geometry/GeometryLayout.tsx';
import PureGeometryTiebaSearchPage from './pages/geometry/PureGeometryTiebaSearchPage.tsx';

const AppLayout: React.FC = () => {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#fbfdff] text-slate-800"
      style={{
        background: 'linear-gradient(180deg, #eef7ff 0px, #f7fbff 170px, #fbfdff 380px, #fbfdff 100%)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(420px 320px at 0 0, rgba(125, 211, 252, 0.18), transparent 72%),
            radial-gradient(460px 340px at 100% 0, rgba(96, 165, 250, 0.14), transparent 72%),
            radial-gradient(600px 500px at 50% 260px, rgba(255, 255, 255, 0.72), transparent 70%)
          `,
        }}
      />
      <Header />
      <main className="relative z-10 flex-grow">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="triples" element={<TriplesLayout />}>
          <Route index element={<TriplesSolverPage />} />
          <Route path="documentation" element={<DocumentationLayout />}>
            <Route index element={<TriplesDocumentationIndexPage />} />
            <Route path="*" element={<DynamicDocPage />} />
          </Route>
        </Route>
        <Route path="geometry" element={<GeometryLayout />}>
          <Route index element={<PureGeometryTiebaSearchPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

const NotFoundPage: React.FC = () => {
  return (
    <div className="py-10 text-center">
      <h1 className="text-4xl font-bold text-blue-600">404</h1>
      <p className="mt-2 text-xl text-slate-700">Page Not Found</p>
      <p className="mt-4">
        <a href="/#" className="text-blue-500 hover:underline">Go back to Home</a>
      </p>
    </div>
  );
};

export default App;
