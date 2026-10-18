import type { GgbPreferences } from './types';

// Site-owned defaults live here; storage, engine integration and UI are independent.
export const DEFAULT_GGB_PREFERENCES: Readonly<GgbPreferences> = Object.freeze({
  axes: false, grid: false, pointLabels: true, lineLabels: false,
  algebra: false, cas: false, spreadsheet: false, graphics2: false, graphics3d: false,
  inputBar: false, decimals: 5, pointSize: 5, pointColor: '#2563eb',
  lineThickness: 3, lineColor: '#475569', palette: 'slate', stylePolicy: 'preserve',
});

export const GGB_PALETTES = [
  { id: 'slate', name: 'Studio blue', point: '#2563eb', line: '#475569' },
  { id: 'ink', name: 'Graphite', point: '#18181b', line: '#71717a' },
  { id: 'forest', name: 'Botanical', point: '#059669', line: '#334155' },
  { id: 'violet', name: 'Iris', point: '#7c3aed', line: '#64748b' },
  { id: 'warm', name: 'Terracotta', point: '#c2410c', line: '#78716c' },
] as const;
