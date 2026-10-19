import type { RelationSeed } from './relationSeed';

// Only exact support-set refinements belong here: a midpoint on three points
// does not cover a collinearity observation involving additional positions.
const RULES = [{ parent: 'midpoint', child: 'collinear' }] as const;
export const compressRefinements = (seeds: RelationSeed[], compress: boolean): RelationSeed[] => {
  const support = (seed: RelationSeed) => [...seed.points].sort((a, b) => a - b).join(',');
  const sources = new Map<string, string>();
  for (const rule of RULES) for (const seed of seeds) if (seed.kind === rule.parent) sources.set(`${rule.child}:${support(seed)}`, seed.key);
  return seeds.flatMap((seed) => {
    const parent = sources.get(`${seed.kind}:${support(seed)}`);
    if (!parent) return [seed];
    return compress ? [] : [{ ...seed, derived: true, sourceIds: [...new Set([...(seed.sourceIds ?? []), parent])] }];
  });
};
