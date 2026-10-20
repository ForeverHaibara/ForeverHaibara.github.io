import React from 'react';

export const usePageEntrance = () => {
  React.useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
};

export const Arrow: React.FC<{ diagonal?: boolean }> = ({ diagonal = false }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
  </svg>
);

export const GeometrySketch: React.FC = () => (
  <svg className="geometry-sketch" viewBox="0 0 420 300" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="0.6" opacity="0.1">
      {[60, 100, 140, 180, 220, 260, 300, 340, 380].map((x) => (
        <path key={x} d={`M${x} 20v260`} />
      ))}
      {[30, 70, 110, 150, 190, 230, 270].map((y) => (
        <path key={y} d={`M20 ${y}h380`} />
      ))}
    </g>
    <circle cx="211" cy="148" r="109" stroke="currentColor" opacity="0.3" />
    <circle cx="211" cy="148" r="66" stroke="currentColor" strokeDasharray="3 5" opacity="0.2" />
    <path
      d="m174 45 136 148-198 2Z"
      fill="currentColor"
      fillOpacity="0.04"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="m174 45 37 103m99 45-99-45m-99 47 99-47" stroke="currentColor" opacity="0.45" />
    <path d="M102 148h218M211 39v218" stroke="currentColor" strokeDasharray="3 5" opacity="0.22" />
    {[
      [174, 45],
      [310, 193],
      [112, 195],
    ].map(([cx, cy]) => (
      <g key={cx}>
        <circle cx={cx} cy={cy} r="7" fill="white" />
        <circle cx={cx} cy={cy} r="3.5" fill="currentColor" />
      </g>
    ))}
    <circle cx="211" cy="148" r="4" fill="currentColor" />
    <g fill="currentColor" fontFamily="Georgia, serif" fontSize="15" fontStyle="italic">
      <text x="163" y="29">
        A
      </text>
      <text x="323" y="203">
        B
      </text>
      <text x="92" y="211">
        C
      </text>
      <text x="220" y="141">
        O
      </text>
    </g>
  </svg>
);
