import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css'; // Import KaTeX CSS

// Define KaTeX options type (can be enhanced or replaced by types from @types/katex if more specific ones are needed)
interface KatexOptions {
  displayMode?: boolean;
  throwOnError?: boolean;
  errorColor?: string;
  macros?: object;
  maxSize?: number;
  maxExpand?: number;
  strict?: boolean | string | Function;
  trust?: boolean | Function;
  output?: "html" | "mathml" | "htmlAndMathml";
}

// No longer need global Window declaration for katex

interface KatexDisplayProps {
  latex: string;
  className?: string;
  isBlockMode?: boolean; // KaTeX displayMode
}

const KatexDisplay: React.FC<KatexDisplayProps> = ({ latex, className = '', isBlockMode = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode: isBlockMode,
        } as KatexOptions); // Cast to KatexOptions if using the local interface
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        if (containerRef.current) { // Check ref again before setting textContent
            containerRef.current.textContent = 'Error rendering LaTeX.';
        }
      }
    }
  }, [latex, isBlockMode]);

  return <div ref={containerRef} className={`katex-render-container ${className}`} aria-live="polite">{latex}</div>;
};

export default KatexDisplay;