import { combineExpressions, matchScalarTransform } from '../algebra/scalarSearch';
import type { RationalRelationSpace } from '../algebra/rationalSpace';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';

interface AngleQuantity { value: number; names: [string, string, string]; indexes: number[]; row: Record<string, number>; representationError: number; }
const PATTERNS = [
  { kind: 'angle-multiple', scale: 2, offset: 0, source: -2, target: 1, denominator: 1, pi: 0 },
  { kind: 'complementary-angles', scale: -1, offset: Math.PI / 2, source: 1, target: 1, denominator: 2, pi: 1 },
  { kind: 'supplementary-angles', scale: -1, offset: Math.PI, source: 1, target: 1, denominator: 1, pi: 1 },
] as const;

/** Ordinary angles in (0,pi); no modular identification of supplements. */
export const detectAngleRelations = (scene: GeometryScene, angles: AngleQuantity[], options: DiscoveryOptions, budget: DiscoveryBudget, space: RationalRelationSpace): RelationSeed[] => {
  const seeds: RelationSeed[] = [];
  const epsilon = 4e-7;
  for (const pattern of PATTERNS) {
    if (!options.enabledKinds.includes(pattern.kind)) continue;
    let count = 0;
    for (const [source, target] of matchScalarTransform(angles, pattern.scale, pattern.offset, epsilon, budget, `${pattern.kind} comparisons`, options.maxComparisons)) {
      if (pattern.scale < 0 && source.value >= target.value) continue; // Symmetric sum, one orientation.
      if (Math.abs(target.value - pattern.scale * source.value - pattern.offset) > epsilon) continue;
      const row = combineExpressions([[source.row, pattern.source * pattern.denominator], [target.row, pattern.target * pattern.denominator], [{ '@pi': -pattern.pi }, 1]]);
      if (Object.keys(row).length === 0) continue; // Universal telescope identity.
      const representationError = pattern.denominator * (Math.abs(pattern.source) * source.representationError + Math.abs(pattern.target) * target.representationError);
      const reduced = space.reduce(row, representationError);
      const derived = reduced.redundant && reduced.error <= epsilon * pattern.denominator;
      if (derived && options.compressConsequences) continue;
      if (count >= options.maxRelations) { budget.note(`${pattern.kind} output limit (${options.maxRelations}) reached; results are partial.`); break; }
      const points = new Set([...source.indexes, ...target.indexes]);
      const key = `${pattern.kind}:${source.names.join('|')}:${target.names.join('|')}`;
      seeds.push({ kind: pattern.kind, key, points, confidence: 0.98, derived, sourceIds: derived ? reduced.sources : [],
        witness: { points: [...points].map((i) => scene.points[i].name), equation: {
          terms: [
            { coefficient: pattern.target, quantity: { kind: 'angle', points: target.names } },
            { coefficient: pattern.source, quantity: { kind: 'angle', points: source.names } },
          ],
          pi: pattern.pi ? { numerator: pattern.pi, denominator: pattern.denominator } : undefined,
        } } });
      count += 1;
      if (!derived) space.insert(row, key, Math.abs(target.value - pattern.scale * source.value - pattern.offset) * pattern.denominator + representationError + 1e-12);
    }
  }
  return seeds;
};
