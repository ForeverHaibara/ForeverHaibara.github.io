
import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS

export interface KatexDisplayProps { // Added export
  latex: string;
  className?: string;
  isBlockMode?: boolean; 
}

const KatexDisplay: React.FC<KatexDisplayProps> = ({ latex, className = '', isBlockMode = true }) => {
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode: isBlockMode, // This is KaTeX's 'displayMode'
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        if (containerRef.current) { 
            containerRef.current.textContent = 'Error rendering LaTeX.';
        }
      }
    }
  }, [latex, isBlockMode]);

  if (isBlockMode) {
    return <span ref={containerRef as React.RefObject<HTMLDivElement>} className={`katex-render-container ${className}`} aria-live="polite">{latex}</span>;
  } else {
    return <span ref={containerRef as React.RefObject<HTMLSpanElement>} className={`katex-render-container ${className}`} aria-live="polite">{latex}</span>;
  }
};

export default KatexDisplay;