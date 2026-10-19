import { groupNearValues } from '../algebra/nearEquality';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { cross, displacement, dot } from '../quantities/vector';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import { buildDirectionSpaces } from './directionSpaces';
import type { RelationSeed } from './relationSeed';
import { detectTriangles } from './triangles';
import { segmentId } from '../quantities/lengths';
import { createLengthRelationSpace, detectLengthRelations } from './lengthRelations';
import { combineExpressions } from '../algebra/scalarSearch';
import { angleAliasSupport, detectAngleRelations } from './angleRelations';
import { groupScalarClasses } from '../algebra/scalarClasses';
import { buildRayClasses, rayAngleCandidates } from '../scene/rays';

export const detectMetricRelations = (scene: GeometryScene, existing: RelationSeed[], options: DiscoveryOptions, budget: DiscoveryBudget): RelationSeed[] => {
  const seeds: RelationSeed[] = [];
  const enabled = new Set(options.enabledKinds);
  const angleKinds = ['equal-angles', 'angle-multiple', 'complementary-angles', 'supplementary-angles'] as const;
  const needsAngles = angleKinds.some((kind) => enabled.has(kind));
  const lengths = createLengthRelationSpace();
  seeds.push(...detectTriangles(scene, options, budget, lengths));
  const directions = needsAngles || enabled.has('direction-space')
    ? buildDirectionSpaces(scene, [...existing, ...seeds], options, budget)
    : { seeds: [], space: new RationalRelationSpace(), bySegment: new Map<string, never>() };
  seeds.push(...directions.seeds);
  const emit = (kind: RelationSeed['kind'], points: Set<number>, witness: RelationSeed['witness'], key: string, derived = false, sourceIds: string[] = [], scoringNames?: string[], support?: RelationSeed['support']) => {
    if (derived && options.compressConsequences) return;
    seeds.push({ kind, points, witness, key: `${kind}:${key}`, confidence: 0.98, derived, sourceIds: [...new Set(sourceIds)], scoringNames, support });
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

  seeds.push(...detectLengthRelations(scene, options, budget, lengths));

  if (needsAngles) {
    interface Angle { value: number; names: [string, string, string]; indexes: number[]; aliases: [string[], string[]]; key: string; error: number; sources: string[]; row: Record<string, number>; representationError: number; }
    const symbolic = new Map<string, Angle[]>();
    const order = scene.points.map((_, i) => i).sort((a, b) => scene.points[a].name.localeCompare(scene.points[b].name));
    const rays = buildRayClasses(scene, directions.bySegment);
    for (const { vertex, firstRay, secondRay } of rayAngleCandidates(rays, order)) {
      const [a, c] = [firstRay.endpoint, secondRay.endpoint];
      if (!budget.take('Angle candidates', options.maxAngles)) break;
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
      const row = combineExpressions([[{ '@pi': constant }, 1], [{ [first.id]: 1 }, -sign], [{ [second.id]: 1 }, sign]]);
      const representationError = Math.abs(value - sign * delta - constant * Math.PI);
      const reduced = directions.space.reduce(row, representationError);
      const angle: Angle = { value, names: [scene.points[a].name, scene.points[vertex].name, scene.points[c].name],
        indexes: [...new Set([vertex, ...firstRay.endpoints, ...secondRay.endpoints])],
        aliases: [firstRay.endpoints.map((i) => scene.points[i].name), secondRay.endpoints.map((i) => scene.points[i].name)], row, representationError, ...reduced };
      angle.sources = [...new Set([...angle.sources, ...[first.incidenceSource, second.incidenceSource].filter((source): source is string => Boolean(source))])];
      // Reduce before numeric comparison: a space needs O(lines) generator
      // fits instead of a pairwise search over all its derived angle values.
      const key = reduced.error <= 4e-7 ? reduced.key : `${a}:${vertex}:${c}`;
      angle.key = key;
      const bucket = symbolic.get(key) ?? []; bucket.push(angle); symbolic.set(key, bucket);
    }
    const epsilon = 4e-7;
    const groups = groupScalarClasses([...symbolic.values()], epsilon, budget, 'Angle comparisons', options.maxComparisons);
    if (enabled.has('equal-angles')) for (const group of groups) {
      const members = group.members;
      if (members.length < 2) continue;
      // Same lifted expression (e.g. vertical angles) is representation alone.
      // Keep its quantity available to comparisons with genuinely other angles.
      if (members.every((angle) => Object.keys(combineExpressions([[angle.row, 1], [members[0].row, -1]])).length === 0)) continue;
      const derived = members.every((angle) => angle.key === members[0].key && angle.error <= epsilon) && members.some((angle) => angle.sources.length > 0);
      const points = new Set(members.flatMap((angle) => angle.indexes));
      emit('equal-angles', points, { points: [...points].map((i) => scene.points[i].name), angles: members.map((angle) => angle.names),
        angleAliases: members.filter((angle) => angle.aliases.some((names) => names.length > 1)).map((angle) => ({ angle: angle.names, endpoints: angle.aliases })) }, members.map((angle) => angle.names.join('|')).sort().join(';'), derived, derived ? members.flatMap((angle) => angle.sources) : [], [...new Set(members.flatMap((angle) => angle.names))], angleAliasSupport(members));
    }
    // Each numerically equal class contributes one representative to affine
    // searches. We never form every pair of angle expressions in a model.
    seeds.push(...detectAngleRelations(scene, groups, options, budget, directions.space));
  }
  if (directions.space.limited || lengths.limited) budget.note('Relation-space reduction budget reached; some algebraic consequences were not compressed.');
  return seeds;
};
