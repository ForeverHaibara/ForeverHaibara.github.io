import type { RelationSeed } from './relationSeed';

// Only exact support-set refinements belong here: a midpoint on three points
// does not cover a collinearity observation involving additional positions.
const RULES = [{ parent: 'midpoint', child: 'collinear' }] as const;
export const annotateRefinements = (seeds: RelationSeed[]): RelationSeed[] => {
  const support = (seed: RelationSeed) => [...seed.points].sort((a, b) => a - b).join(',');
  const sources = new Map<string, string>();
  for (const rule of RULES) for (const seed of seeds) if (seed.kind === rule.parent) sources.set(`${rule.child}:${support(seed)}`, seed.key);
  // Keep the Basic observation searchable even when the stronger condition is
  // displayed in another category (Lengths).
  return seeds.map((seed) => {
    const parent = sources.get(`${seed.kind}:${support(seed)}`);
    if (!parent) return seed;
    return { ...seed, derived: true, sourceIds: [...new Set([...(seed.sourceIds ?? []), parent])] };
  });
};
