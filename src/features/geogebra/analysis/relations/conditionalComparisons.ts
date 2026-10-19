import type { RelationCondition } from '../geometryTypes';
import { segmentKey } from '../algebra/lengthConstraint';
import type { Segment } from '../algebra/lengthConstraint';
import type { GeometryScene } from '../scene/geometryScene';
import type { RelationSeed } from './relationSeed';

/** Decompose an observed comparator, not the command that created its points.
 * Midpoint facts are checked directly in the immutable scene, independently
 * of the triangle's own inserted length rows or the UI's enabled types. */
export const analyzeSharedComparisons = (scene: GeometryScene, seeds: RelationSeed[]): RelationSeed[] => {
  const byName = new Map(scene.points.map((point) => [point.name, point.coordinates]));
  const distance = (a: string, b: string) => {
    const p = byName.get(a)!; const q = byName.get(b)!;
    return Math.hypot(p.x - q.x, p.y - q.y);
  };
  return seeds.map((seed) => {
    const triangles = seed.witness.triangles;
    if (seed.kind !== 'congruent-triangles' || triangles?.length !== 2) return seed;
    const [first, second] = triangles;
    if (first.filter((name) => second.includes(name)).length !== 2) return seed;
    const conditions: RelationCondition[] = [];
    const guards = new Map<string, Segment>();
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      const a: Segment = [first[i], first[j]]; const b: Segment = [second[i], second[j]];
      guards.set(segmentKey(a), a); guards.set(segmentKey(b), b);
      if (segmentKey(a) === segmentKey(b)) continue;
      const shared = a.filter((name) => b.includes(name));
      const ends = [...a, ...b].filter((name) => !shared.includes(name));
      const locus = shared.length === 1 && ends.length === 2
        ? { kind: 'perpendicular-bisector' as const, point: shared[0], segment: ends as Segment } : undefined;
      const p = locus && byName.get(locus.point)!;
      const u = locus && byName.get(locus.segment[0])!; const v = locus && byName.get(locus.segment[1])!;
      const background = Boolean(locus && p && u && v
        && Math.hypot(p.x - (u.x + v.x) / 2, p.y - (u.y + v.y) / 2) <= scene.tolerance.distance
        && Math.abs(Math.log(distance(...a) / distance(...b))) <= 4e-7);
      // This source is a primitive coordinate check, never a child of `seed`.
      const sourceIds = background ? [`midpoint-fact:${locus!.point}:${[...locus!.segment].sort().join('|')}`] : [];
      conditions.push({ equation: { terms: [{ coefficient: 1, quantity: { kind: 'length', points: a } }, { coefficient: -1, quantity: { kind: 'length', points: b } }] }, background, sourceIds, locus });
    }
    if (conditions.length === 0) return seed;
    // A newly observed primitive background is not necessarily familiar to
    // the user. Keep its small core as well as the conditional residual;
    // otherwise an interesting midpoint could disappear with its value.
    const scoringGroups = conditions.map((condition) => [...new Set(condition.equation.terms.flatMap((term) => term.quantity.points))].sort());
    const effective = [...new Set(scoringGroups.flat())].sort();
    const assumptions = [...new Set(conditions.filter((condition) => condition.background).flatMap((condition) => condition.equation.terms.flatMap((term) => term.quantity.points)))].sort();
    return { ...seed, witness: { ...seed.witness, conditions }, scoringGroups,
      support: { effective, assumptions, guards: [...guards.values()], frame: [],
        reason: 'Shared SSS terms cancelled; independent midpoint cores retained. Value is the maximum over core and remaining conditions.' } };
  });
};
