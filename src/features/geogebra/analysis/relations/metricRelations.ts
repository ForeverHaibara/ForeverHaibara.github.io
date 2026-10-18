import { groupNearValues } from '../algebra/nearEquality';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { cross, displacement, dot } from '../quantities/vector';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import { buildDirectionSpaces } from './directionSpaces';
import type { RelationSeed } from './relationSeed';
import { detectTriangles, segmentId } from './triangles';

export const detectMetricRelations = (scene: GeometryScene, existing: RelationSeed[], options: DiscoveryOptions, budget: DiscoveryBudget): RelationSeed[] => {
  const seeds: RelationSeed[] = [];
  const enabled = new Set(options.enabledKinds);
  if (!['similar-triangles', 'congruent-triangles', 'coincident-points', 'equal-lengths', 'equal-angles', 'direction-space'].some((kind) => enabled.has(kind as RelationSeed['kind']))) return seeds;
  const lengths = new RationalRelationSpace(new Set());
  seeds.push(...detectTriangles(scene, options, budget, lengths));
  const directions = enabled.has('equal-angles') || enabled.has('direction-space')
    ? buildDirectionSpaces(scene, [...existing, ...seeds], options, budget)
    : { seeds: [], space: new RationalRelationSpace(), bySegment: new Map<string, never>() };
  seeds.push(...directions.seeds);
  const emit = (kind: RelationSeed['kind'], points: Set<number>, witness: RelationSeed['witness'], key: string, derived = false, sourceIds: string[] = []) => {
    if (derived && options.compressConsequences) return;
    seeds.push({ kind, points, witness, key: `${kind}:${key}`, confidence: 0.98, derived, sourceIds: [...new Set(sourceIds)] });
  };

  if (enabled.has('coincident-points')) {
    const representatives = new Map(scene.points.flatMap((point, i) => point.aliases.map((name) => [name, i] as const)));
    const input = scene.input.filter((point) => representatives.has(point.name));
    const origin = input[0]?.coordinates ?? { x: 0, y: 0 };
    const epsilon = scene.tolerance.distance;
    const normalized = input.map((point) => ({ ...point, x: (point.coordinates.x - origin.x) / scene.scale, y: (point.coordinates.y - origin.y) / scene.scale }));
    const groups = groupNearValues(normalized, {
      bucket: (p) => [Math.floor(p.x / epsilon), Math.floor(p.y / epsilon)],
      matches: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= epsilon,
    }, budget, 'Coincidence comparisons', options.maxComparisons);
    for (const group of groups.filter((g) => g.length > 1)) {
      const names = group.map((point) => point.name).sort();
      seeds.push({ kind: 'coincident-points', points: new Set(names.map((name) => representatives.get(name)!)), key: `coincident:${names.join('|')}`,
        witness: { points: names }, scoringNames: names, expandAliases: false, confidence: 0.98 });
    }
  }

  if (enabled.has('equal-lengths')) {
    const epsilon = 4e-7;
    const groups = groupNearValues(scene.pairs, {
      bucket: (pair) => [Math.floor(Math.log(pair.length) / epsilon)],
      matches: (a, b) => Math.abs(Math.log(a.length / b.length)) <= epsilon,
    }, budget, 'Length comparisons', options.maxComparisons);
    for (const group of groups) {
      if (group.length < 2) continue;
      const keys = group.map((pair) => lengths.reduce({ [segmentId(pair.left, pair.right)]: 1 }));
      const derived = keys.every((key) => key.key === keys[0].key && key.error < 1e-5) && keys.some((key) => key.sources.length > 0);
      const segments = group.map((pair) => [scene.points[pair.left].name, scene.points[pair.right].name] as [string, string]);
      const points = new Set(group.flatMap((pair) => [pair.left, pair.right]));
      emit('equal-lengths', points, { points: [...points].map((i) => scene.points[i].name), segments }, segments.map((s) => s.join('|')).sort().join(';'), derived, derived ? keys.flatMap((key) => key.sources) : []);
    }
  }

  if (enabled.has('equal-angles')) {
    interface Angle { value: number; names: [string, string, string]; indexes: number[]; key: string; error: number; sources: string[]; }
    const symbolic = new Map<string, Angle[]>();
    outer: for (let a = 0; a < scene.points.length; a += 1) for (let c = a + 1; c < scene.points.length; c += 1) for (let vertex = 0; vertex < scene.points.length; vertex += 1) {
      if (a === vertex || c === vertex) continue;
      if (!budget.take('Angle candidates', options.maxAngles)) break outer;
      const first = directions.bySegment.get(segmentId(vertex, a)); const second = directions.bySegment.get(segmentId(vertex, c));
      if (!first || !second) continue;
      const u = displacement(scene.points[vertex].coordinates, scene.points[a].coordinates);
      const v = displacement(scene.points[vertex].coordinates, scene.points[c].coordinates);
      if (Math.min(Math.hypot(u.x, u.y), Math.hypot(v.x, v.y)) <= scene.tolerance.minimumLength) continue;
      const value = Math.atan2(Math.abs(cross(u, v)), dot(u, v));
      if (value < 4e-7 || Math.PI - value < 4e-7) continue; // Flat observations already have collinearity groups.
      const delta = second.angle - first.angle;
      const sign = Math.abs(value - delta - Math.round((value - delta) / Math.PI) * Math.PI) < 4e-7 ? 1 : -1;
      const constant = Math.round((value - sign * delta) / Math.PI);
      const row: Record<string, number> = { '@pi': constant };
      row[first.id] = (row[first.id] ?? 0) - sign; row[second.id] = (row[second.id] ?? 0) + sign;
      const reduced = directions.space.reduce(row);
      const angle: Angle = { value, names: [scene.points[a].name, scene.points[vertex].name, scene.points[c].name], indexes: [a, vertex, c], ...reduced };
      angle.sources = [...new Set([...angle.sources, ...[first.incidenceSource, second.incidenceSource].filter((source): source is string => Boolean(source))])];
      // Reduce before numeric comparison: a space needs O(lines) generator
      // fits instead of a pairwise search over all its derived angle values.
      const key = reduced.error <= 4e-7 ? reduced.key : `${a}:${vertex}:${c}`;
      angle.key = key;
      const bucket = symbolic.get(key) ?? []; bucket.push(angle); symbolic.set(key, bucket);
    }
    const representatives = [...symbolic.values()].map((angles) => angles[0]);
    const epsilon = 4e-7;
    const groups = groupNearValues(representatives, {
      bucket: (angle) => [Math.floor(angle.value / epsilon)],
      matches: (a, b) => Math.abs(a.value - b.value) <= epsilon,
    }, budget, 'Angle comparisons', options.maxComparisons);
    for (const group of groups) {
      const members = group.flatMap((angle) => symbolic.get(angle.key) ?? [angle]);
      // Recheck every published member against all others via min/max, even
      // when their symbolic forms agree under approximate observed equations.
      let minimum = Infinity; let maximum = -Infinity;
      for (const member of members) { minimum = Math.min(minimum, member.value); maximum = Math.max(maximum, member.value); }
      if (members.length < 2 || maximum - minimum > epsilon) continue;
      const derived = group.length === 1 && members.some((angle) => angle.sources.length > 0);
      const points = new Set(members.flatMap((angle) => angle.indexes));
      emit('equal-angles', points, { points: [...points].map((i) => scene.points[i].name), angles: members.map((angle) => angle.names) }, members.map((angle) => angle.names.join('|')).sort().join(';'), derived, derived ? members.flatMap((angle) => angle.sources) : []);
    }
  }
  if (directions.space.limited || lengths.limited) budget.note('Relation-space reduction budget reached; some algebraic consequences were not compressed.');
  return seeds;
};
