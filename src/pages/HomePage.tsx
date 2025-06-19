
import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-xl animate-fadeIn">
      <header className="text-center mb-12">
        <h1 className="space-y-8 text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-sky-400 mb-4">
          Welcome to My GitHub Page
        </h1>
        <p className="space-y-8 text-xl text-slate-600 max-w-2xl mx-auto">
          I'm ForeverHaibara.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-slate-50 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold text-blue-700 mb-3">Triples Inequality Solver</h2>
          <p className="text-slate-600 mb-4">
            A Python library for proving algebraic inequalities via sum-of-squares.
          </p>
          <Link
            to="/triples"
            className="inline-block bg-blue-600 text-white font-medium py-2 px-5 rounded-md hover:bg-blue-700 transition-colors shadow hover:shadow-md transform hover:scale-105"
          >
            Try Triples Solver
          </Link>
        </div>
        <div className="bg-slate-50 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold text-blue-700 mb-3">About Me</h2>
          <p className="text-slate-600 mb-4">
            Learn more about my journey, skills, and interests.
          </p>
          <Link
            to="/about"
            className="inline-block bg-transparent border-2 border-blue-600 text-blue-600 font-medium py-2 px-5 rounded-md hover:bg-blue-50 hover:text-blue-700 transition-colors shadow hover:shadow-md"
          >
            Read More About Me
          </Link>
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-3xl font-semibold text-slate-700 mb-6">Explore Further</h2>
        <p className="text-slate-600 max-w-xl mx-auto">
          This is written by Gemini.
          {/* Feel free to navigate through the sections and discover what I've been working on.
          More content (like blog posts or project showcases) will be added here. */}
        </p>
      </section>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.8s ease-out forwards;
          }
        `}
      </style>
    </div>
  );
};

export default HomePage;
