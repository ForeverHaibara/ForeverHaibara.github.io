import { groupNearValues } from '../algebra/nearEquality';
import type { RationalRelationSpace } from '../algebra/rationalSpace';
import { orientedDoubleArea } from '../quantities/vector';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';

export const segmentId = (a: number, b: number): string => `s:${Math.min(a, b)}:${Math.max(a, b)}`;
interface Triangle { vertices: [number, number, number]; sides: number[]; shape: number[]; }

export const detectTriangles = (scene: GeometryScene, options: DiscoveryOptions, budget: DiscoveryBudget, lengths: RationalRelationSpace): RelationSeed[] => {
  const congruent = options.enabledKinds.includes('congruent-triangles');
  const similar = options.enabledKinds.includes('similar-triangles');
  if (!congruent && !similar) return [];
  const triangles: Triangle[] = [];
  const measured = new Map(scene.pairs.map((pair) => [segmentId(pair.left, pair.right), pair.length]));
  const distance = (a: number, b: number) => measured.get(segmentId(a, b)) ?? Math.hypot(scene.points[a].coordinates.x - scene.points[b].coordinates.x, scene.points[a].coordinates.y - scene.points[b].coordinates.y);
  outer: for (let a = 0; a < scene.points.length; a += 1) for (let b = a + 1; b < scene.points.length; b += 1) for (let c = b + 1; c < scene.points.length; c += 1) {
    if (!budget.take('Triangle candidates', options.maxTriangles)) break outer;
    const opposite = new Map([[a, distance(b, c)], [b, distance(a, c)], [c, distance(a, b)]]);
    const vertices = [a, b, c].sort((left, right) => opposite.get(left)! - opposite.get(right)! || scene.points[left].name.localeCompare(scene.points[right].name)) as [number, number, number];
    const sides = vertices.map((vertex) => opposite.get(vertex)!);
    const [p, q, r] = vertices.map((vertex) => scene.points[vertex].coordinates);
    if (sides[0] <= scene.tolerance.minimumLength || Math.abs(orientedDoubleArea(p, q, r)) <= 2e-7 * sides[2] ** 2) continue;
    triangles.push({ vertices, sides, shape: [sides[0] / sides[2], sides[1] / sides[2]] });
  }
  const epsilon = 8e-7;
  const shapes = groupNearValues(triangles, {
    bucket: (t) => t.shape.map((v) => Math.floor(v / epsilon)),
    matches: (a, b) => a.shape.every((v, i) => Math.abs(v - b.shape[i]) <= epsilon),
  }, budget, 'Triangle comparisons', options.maxComparisons);
  const seeds: RelationSeed[] = [];
  const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const shape of shapes) {
    if (shape.length < 2) continue;
    const sizeGroups = groupNearValues(shape, {
      bucket: (t) => [Math.floor(Math.log(t.sides[2]) / epsilon)],
      matches: (a, b) => Math.abs(Math.log(a.sides[2] / b.sides[2])) <= epsilon,
    }, budget, 'Triangle comparisons', options.maxComparisons);
    const emit = (group: Triangle[], kind: 'similar-triangles' | 'congruent-triangles') => {
      if (group.length < 2) return;
      const reference = group[0];
      const corresponding = group.map((triangle) => {
        // Sorted shapes can straddle an equal-side tie. Verify all six maps.
        for (const permutation of permutations) {
          const v = permutation.map((i) => triangle.vertices[i]) as [number, number, number];
          const sides = [distance(v[1], v[2]), distance(v[0], v[2]), distance(v[0], v[1])];
          const scale = kind === 'congruent-triangles' ? 1 : sides[2] / reference.sides[2];
          if (sides.every((value, i) => Math.abs(value - scale * reference.sides[i]) <= epsilon * Math.max(value, scale * reference.sides[i]))) return v;
        }
        return null;
      }).filter((v): v is [number, number, number] => v !== null);
      if (corresponding.length < 2) return;
      const names = corresponding.map((v) => v.map((i) => scene.points[i].name) as [string, string, string]);
      const source = `${kind}:${names.map((v) => v.join('|')).sort().join(';')}`;
      const edges = (v: number[]) => [segmentId(v[1], v[2]), segmentId(v[0], v[2]), segmentId(v[0], v[1])];
      const baseEdges = edges(corresponding[0]);
      for (const v of options.enabledKinds.includes('equal-lengths') ? corresponding.slice(1) : []) {
        const other = edges(v);
        for (let i = 0; i < 3; i += 1) {
          const row: Record<string, number> = {};
          const term = (id: string, coefficient: number) => { row[id] = (row[id] ?? 0) + coefficient; };
          term(baseEdges[i], 1); term(other[i], -1);
          if (kind === 'similar-triangles') { term(baseEdges[2], -1); term(other[2], 1); }
          lengths.insert(row, source, epsilon * 4);
        }
      }
      const points = new Set(corresponding.flat());
      const symmetryOrder = reference.sides[2] - reference.sides[0] <= epsilon * reference.sides[2] ? 6
        : reference.sides.some((side, i) => reference.sides.some((other, j) => i !== j && Math.abs(side - other) <= epsilon * Math.max(side, other))) ? 2 : 1;
      seeds.push({ key: source, kind, points,
        witness: { points: [...points].map((i) => scene.points[i].name), triangles: names, triangleSymmetryOrder: symmetryOrder }, confidence: 0.98 });
    };
    if (congruent) for (const group of sizeGroups) emit(group, 'congruent-triangles');
    // Congruence is a refinement of similarity; emit the parent only if it adds scale classes.
    if (similar && (!congruent || sizeGroups.length > 1)) emit(shape, 'similar-triangles');
  }
  return seeds;
};
