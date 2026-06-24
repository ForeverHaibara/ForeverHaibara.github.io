import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="overflow-hidden rounded-[32px] border border-white/65 bg-white/58 p-8 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:p-10">
      <h1 className="mb-6 border-b border-sky-100 pb-4 text-4xl font-semibold tracking-[-0.04em] text-sky-900">About Me</h1>
      
      <div className="space-y-6 text-lg leading-relaxed text-slate-700">
        <p>
          Hello! This is re-designed by ChatGPT and Codex!
        </p>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-semibold text-sky-800">My Philosophy</h2>
        <div className="rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.88),rgba(248,250,252,0.72))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <p className="text-slate-700 italic">
            "ChatGPT is better."
          </p>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
