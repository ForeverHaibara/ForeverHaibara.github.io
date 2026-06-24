import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="animate-fadeIn">
      <section className="relative overflow-hidden rounded-[32px] border border-white/65 bg-white/58 px-6 py-10 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-32 rounded-full blur-3xl"
          style={{ background: 'linear-gradient(90deg, rgba(125,211,252,0.24), rgba(191,219,254,0.12), rgba(255,255,255,0))' }}
        />
        <header className="relative mb-12 text-center">
          <h1 className="mb-4 bg-[linear-gradient(135deg,#0f3b73_0%,#2563eb_45%,#38bdf8_100%)] bg-clip-text text-5xl font-semibold tracking-[-0.05em] text-transparent sm:text-6xl">
            Welcome to My GitHub Page
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            I'm ForeverHaibara.
          </p>
        </header>

        <section className="relative mb-12 grid gap-6 md:grid-cols-2">
          <div className="group rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(239,246,255,0.72))] p-7 shadow-[0_16px_40px_rgba(148,163,184,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(96,165,250,0.16)]">
            <h2 className="mb-3 text-2xl font-semibold text-sky-900">Triples Inequality Solver</h2>
            <p className="mb-5 text-slate-600">
              A Python library for proving algebraic inequalities via sum-of-squares.
            </p>
            <Link
              to="/triples"
              className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#1d4ed8_0%,#38bdf8_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_12px_24px_rgba(59,130,246,0.24)] transition-all duration-300 hover:translate-x-1 hover:shadow-[0_16px_30px_rgba(59,130,246,0.28)]"
            >
              Try Triples Solver
            </Link>
          </div>
          <div className="group rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,250,252,0.72))] p-7 shadow-[0_16px_40px_rgba(148,163,184,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(125,211,252,0.18)]">
            <h2 className="mb-3 text-2xl font-semibold text-sky-900">About Me</h2>
            <p className="mb-5 text-slate-600">
              Learn more about my journey, skills, and interests.
            </p>
            <Link
              to="/about"
              className="inline-flex items-center rounded-full border border-sky-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-sky-700 shadow-[0_10px_24px_rgba(148,163,184,0.1)] transition-all duration-300 hover:translate-x-1 hover:border-sky-300 hover:bg-white hover:text-sky-800"
            >
              Read More About Me
            </Link>
          </div>
        </section>

        <section className="relative text-center">
          <div className="mx-auto max-w-3xl rounded-[28px] border border-white/70 bg-white/42 px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <h2 className="mb-4 text-3xl font-semibold text-slate-700">Explore Further</h2>
            <p className="mx-auto max-w-xl text-slate-600">
              This is written by Gemini.
            </p>
          </div>
        </section>
      </section>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(18px); }
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
