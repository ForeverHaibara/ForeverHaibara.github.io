
import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import HomePage from './pages/HomePage.tsx';
import AboutPage from './pages/AboutPage.tsx';
import TriplesLayout from './pages/triples/TriplesLayout.tsx';
import TriplesSolverPage from './pages/triples/TriplesSolverPage.tsx';
import TriplesDocumentationPage from './pages/triples/TriplesDocumentationPage.tsx';

const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Outlet />
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
          <Route path="documentation" element={<TriplesDocumentationPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

const NotFoundPage: React.FC = () => {
  return (
    <div className="text-center py-10">
      <h1 className="text-4xl font-bold text-blue-600">404</h1>
      <p className="text-xl text-slate-700 mt-2">Page Not Found</p>
      <p className="mt-4">
        <a href="/#" className="text-blue-500 hover:underline">Go back to Home</a>
      </p>
    </div>
  );
};

export default App;