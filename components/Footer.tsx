
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-slate-800 text-slate-300 py-8 text-center">
      <div className="container mx-auto px-4">
        <p>&copy; {currentYear} ForeverHaibara. All rights reserved.</p>
        <p className="mt-2 text-sm">
          Built with React, Tailwind CSS, and <span className="text-blue-400">❤</span>
        </p>
        {/* Optional: Add links to GitHub, LinkedIn, etc. */}
        {/* <div className="mt-4 space-x-4">
          <a href="https://github.com/ForeverHaibara" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">GitHub</a>
        </div> */}
      </div>
    </footer>
  );
};

export default Footer;
