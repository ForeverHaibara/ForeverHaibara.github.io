
import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-xl">
      <h1 className="text-4xl font-bold text-blue-700 mb-6 border-b-2 border-blue-200 pb-3">About Me</h1>
      
      <div className="space-y-6 text-slate-700 text-lg leading-relaxed">
        {/* <p>
          Hello! I'm ForeverHaibara. Welcome to my personal website. This platform serves as a canvas for my thoughts, projects, and explorations in the world of technology and beyond.
        </p> */}
        <p>
          Hello! This is written by Gemini!
        </p>
        {/* <p>
          I have a passion for software development, particularly in creating elegant and efficient solutions to complex problems. My interests span across various domains, including mathematical algorithms, web development, and machine learning.
        </p>
        <p>
          One of my recent projects is the 'triples' library, an inequality proof system based on the sum of squares method. You can find an interactive demo of it on this site.
        </p>
        <p>
          This website is built using React, TypeScript, and Tailwind CSS, reflecting my preference for modern web technologies. I believe in clean code, intuitive user experiences, and continuous learning.
        </p>
        <p>
          Thank you for visiting. I hope you find something interesting here! Feel free to connect with me through my professional networks (links can be added to the footer or here).
        </p> */}
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-blue-600 mb-4">My Philosophy</h2>
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <p className="text-slate-700 italic">
            "Gemini is good."
          </p>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
