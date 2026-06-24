import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="relative z-10 mt-8 border-t border-white/50 bg-white/45 py-8 text-center text-slate-600 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p>&copy; {currentYear} ForeverHaibara. All rights reserved.</p>
        <p className="mt-2 text-sm">
          Built with React, Tailwind CSS, and care.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
