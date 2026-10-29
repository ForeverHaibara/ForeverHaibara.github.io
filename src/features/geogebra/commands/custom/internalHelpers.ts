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

export const isExpectedHelperType = (kind: 'number' | 'numberList' | 'function', nativeType: unknown): boolean => {
  const type = String(nativeType ?? '').toLowerCase().replace(/^geo/u, '');
  if (kind === 'number') return ['numeric', 'number', 'integer', 'angle'].includes(type);
  if (kind === 'numberList') return type === 'list';
  return ['function', 'functionnvar', 'multivariablefunction'].includes(type);
};
