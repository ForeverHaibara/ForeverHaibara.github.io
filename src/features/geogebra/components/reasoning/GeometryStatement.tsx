import React from 'react';
import KatexDisplay from '../../../../components/KatexDisplay';
import type { VectorNotation } from '../../geometry/vectorProducts';

/** A shared accessible text fallback, with mathematical vector notation on screen. */
const GeometryStatement: React.FC<{ format: (notation: VectorNotation) => string }> = ({ format }) => {
  const text = format('text'); const latex = format('latex');
  if (text === latex) return <>{text}</>;
  return <span className="inline-block max-w-full overflow-x-auto align-middle py-1" role="math" aria-label={text}>
    <span aria-hidden="true"><KatexDisplay latex={latex} isBlockMode={false} /></span>
  </span>;
};

export default GeometryStatement;
