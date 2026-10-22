import React from 'react';

const paths = {
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3C21 7 17 3 12 3ZM7 10h.01M10 6.5h.01M15 7h.01M6.5 14h.01',
  files: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  left: 'M9 3v18M14 9l-3 3 3 3',
  right: 'M15 3v18M10 9l3 3-3 3',
  bottom: 'M3 15h18M9 9l3 3 3-3',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9.5 3l-.6 2-2 .9-1.9-.5-2 3.4 1.4 1.5v2.4L3 14.2l2 3.4 1.9-.5 2 .9.6 2h4l.6-2 2-.9 1.9.5 2-3.4-1.4-1.5v-2.4L20 8.8l-2-3.4-1.9.5-2-.9-.6-2h-4Z',
  expand: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  collapse: 'M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5',
  focus: 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3M9 12h6M12 9v6',
  pin: 'M9 3h6M9 3v6l-3 5h12l-3-5V3M12 14v7',
  float: 'M3 5h18v14H3V5ZM10 11h8v5h-8v-5Z',
  close: 'M6 6l12 12M18 6 6 18',
  open: 'M3 9V5h7l2 3h9l-3 12H3V9Zm0 3h16',
  download: 'M12 3v12M7 10l5 5 5-5M4 17v4h16v-4',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  reset: 'M3 4v6h6M3 10a9 9 0 1 1 2 8',
  run: 'm9 5 10 7-10 7V5Z',
  geometry: 'm12 3 9 17H3L12 3ZM12 3v17M3 20l14-8',
} as const;

export type StudioIconName = keyof typeof paths;
export default function StudioIcon({ name, size = 18 }: { name: StudioIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{['left', 'right', 'bottom'].includes(name) && <rect x="3" y="3" width="18" height="18" rx="2" />}<path d={paths[name]} /></svg>;
}

export function StudioIconButton({ icon, label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: StudioIconName; label: string }) {
  return <button type="button" className="ggb-icon-button" title={label} aria-label={label} {...props}><StudioIcon name={icon} /></button>;
}
