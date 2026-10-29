/** The high-entropy group token survives .ggb export and reload. */
export const isInternalHelperName = (name: string): boolean => /^ggbaux[0-9a-f]{16}nv\d+$/u.test(name);

export const newHelperGroupId = (): string => crypto.randomUUID().replace(/-/gu, '').slice(0, 16);

const activeGroups = new Set<string>();

/** Prevent orphan collection while a native multi-line construction is in flight. */
export const beginHelperGroup = (id: string): (() => void) => {
  activeGroups.add(id);
  return () => { activeGroups.delete(id); };
};

export const isActiveHelperGroup = (id: string): boolean => activeGroups.has(id);

import type { BindValueKind } from './algebra/homogeneous';

export const isExpectedHelperType = (kind: BindValueKind, nativeType: unknown): boolean => {
  const type = String(nativeType ?? '').toLowerCase().replace(/^geo/u, '');
  if (kind === 'number') return ['numeric', 'number', 'integer', 'angle'].includes(type);
  if (kind === 'numberList') return type === 'list';
  if (kind === 'function') return ['function', 'functionnvar', 'multivariablefunction'].includes(type);
  if (kind === 'point') return ['point', 'pointonpath', 'pointinregion'].includes(type);
  if (kind === 'vector') return type === 'vector';
  if (kind === 'line') return type === 'line';
  if (kind === 'circle') return type === 'circle';
  if (kind === 'conic') return ['conic', 'ellipse', 'hyperbola', 'parabola', 'intersectinglines', 'parallellines', 'doubleline', 'emptyset'].includes(type);
  return ['implicitpoly', 'implicitcurve'].includes(type);
};
