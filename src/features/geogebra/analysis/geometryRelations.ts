import { clusterByBuckets, circularDistance, DisjointSet } from './equivalence';
import { buildDependencyProfile, explainDependencySeparation, measureDependencySeparation, scoreDependencySeparation } from './dependencyMetric';
import type { DependencyGraph, GraphNode, PointCoordinate } from './graphTypes';
import type { GeometryPoint, GeometryRelation, GeometryRelationKind, GeometryRelationResult, GeometryTolerance, RelationWitness } from './geometryTypes';

interface PointPair {
  left: number;
  right: number;
  angle: number;
  length: number;
}

interface LineGroup {
  directionRoot: number;
  points: Set<number>;
  pairs: PointPair[];
}

interface RelationSeed {
  key: string;
  kind: GeometryRelationKind;
  witness: RelationWitness;
  points: Set<number>;
  confidence: number;
}

interface CircleCandidate {
  centerX: number;
  centerY: number;
  radius: number;
  points: [number, number, number];
}

interface AnalysisPoint extends GeometryPoint {
  aliases: string[];
}

const RELATION_ORDER: GeometryRelationKind[] = ['concyclic', 'perpendicular', 'parallel', 'collinear'];
const MAX_WITNESSES = 8;
const MAX_CIRCLE_CANDIDATES = 8000;
const RELATIVE_DISTANCE = 2e-7;
// Beyond this dynamic range, directions to a distant point cannot reliably
// distinguish points in the main construction at our angular tolerance.
const MAX_NORMALIZED_COORDINATE = 1 / RELATIVE_DISTANCE;

const normalizeAngle = (angle: number): number => {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
};

const buildTolerance = (scale = 1): GeometryTolerance => ({
  scale,
  distance: scale * RELATIVE_DISTANCE,
  angular: RELATIVE_DISTANCE,
  lineOffset: scale * RELATIVE_DISTANCE * 2,
  circleCenter: scale * RELATIVE_DISTANCE * 3,
  circleRadius: scale * RELATIVE_DISTANCE * 3,
  minimumLength: scale * RELATIVE_DISTANCE,
});

const lowerMedian = (values: number[]): number => values.sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];

const preparePoints = (input: readonly GeometryPoint[], diagnostics: string[]): { points: AnalysisPoint[]; scale: number } => {
  // Exact aliases must not weight the scale estimate, particularly when many
  // constructed objects happen to occupy a single position.
  const positions = new Map<string, AnalysisPoint>();
  input.forEach((point) => {
    const key = `${point.coordinates.x}:${point.coordinates.y}`;
    const existing = positions.get(key);
    if (existing) existing.aliases.push(point.name);
    else positions.set(key, { ...point, aliases: [point.name] });
  });
  const unique = [...positions.values()];
  if (unique.length === 0) return { points: [], scale: 1 };
  const origin = {
    x: lowerMedian(unique.map((point) => point.coordinates.x)),
    y: lowerMedian(unique.map((point) => point.coordinates.y)),
  };
  // A median of local distance medians resists isolated huge coordinates as
  // well as small numerical differences between otherwise coincident points.
  const localScales = unique.flatMap((point, index) => {
    const distances = unique.flatMap((other, otherIndex) => {
      if (index === otherIndex) return [];
      const distance = Math.hypot(point.coordinates.x - other.coordinates.x, point.coordinates.y - other.coordinates.y);
      return Number.isFinite(distance) && distance > 0 ? [distance] : [];
    });
    return distances.length > 0 ? [lowerMedian(distances)] : [];
  });
  const scale = localScales.length > 0 ? lowerMedian(localScales) : 1;
  const points: AnalysisPoint[] = [];
  const excluded: string[] = [];
  unique.forEach((point) => {
    const coordinates = { x: (point.coordinates.x - origin.x) / scale, y: (point.coordinates.y - origin.y) / scale };
    if (!Number.isFinite(coordinates.x) || !Number.isFinite(coordinates.y)
      || Math.hypot(coordinates.x, coordinates.y) > MAX_NORMALIZED_COORDINATE) {
      excluded.push(...point.aliases);
      return;
    }
    // Compare to a fixed representative instead of transitively merging a
    // chain of close points whose endpoints are actually distinct.
    const existing = points.find((candidate) => Math.hypot(candidate.coordinates.x - coordinates.x, candidate.coordinates.y - coordinates.y) <= RELATIVE_DISTANCE);
    if (existing) existing.aliases.push(...point.aliases);
    else points.push({ ...point, coordinates });
  });
  if (excluded.length > 0) diagnostics.push(`Skipped points with extreme coordinate scales because their relations cannot be evaluated reliably: ${excluded.join(', ')}.`);
  return { points, scale };
};

const pointsFromPairs = (pairs: readonly PointPair[]): Set<number> => new Set(pairs.flatMap((pair) => [pair.left, pair.right]));

const linePointIndexes = (line: LineGroup, points: readonly GeometryPoint[]): number[] => {
  const direction = line.pairs[0]?.angle ?? 0;
  const dx = Math.cos(direction);
  const dy = Math.sin(direction);
  return [...line.points].sort((left, right) => {
    const leftProjection = points[left].coordinates.x * dx + points[left].coordinates.y * dy;
    const rightProjection = points[right].coordinates.x * dx + points[right].coordinates.y * dy;
    return leftProjection - rightProjection;
  });
};

const linePointNames = (line: LineGroup, points: readonly GeometryPoint[]): string[] => linePointIndexes(line, points).map((index) => points[index].name);

const lineFamilyNames = (lines: readonly LineGroup[], points: readonly GeometryPoint[]): string[][] => lines.map((line) => linePointNames(line, points));

const groupLinePairs = (pairs: readonly PointPair[], directionRoot: number, tolerance: GeometryTolerance, points: readonly GeometryPoint[]): LineGroup[] => {
  const groups: LineGroup[] = [];
  // Short segments provide a local reference: two almost parallel rays to a
  // faraway point must not imply that their nearby endpoints are collinear.
  [...pairs].sort((a, b) => a.length - b.length).forEach((pair) => {
    const group = groups.find((candidate) => {
      const anchor = candidate.pairs[0];
      const origin = points[anchor.left].coordinates;
      const end = points[anchor.right].coordinates;
      const dx = (end.x - origin.x) / anchor.length;
      const dy = (end.y - origin.y) / anchor.length;
      return [pair.left, pair.right].every((index) => {
        const point = points[index].coordinates;
        return Math.abs(dx * (point.y - origin.y) - dy * (point.x - origin.x)) <= tolerance.lineOffset;
      });
    });
    if (group) {
      group.pairs.push(pair);
      group.points.add(pair.left);
      group.points.add(pair.right);
    } else groups.push({ directionRoot, pairs: [pair], points: pointsFromPairs([pair]) });
  });
  return groups;
};

const createCircle = (a: PointCoordinate, b: PointCoordinate, c: PointCoordinate): { centerX: number; centerY: number; radius: number } | null => {
  const bx = b.x - a.x;
  const by = b.y - a.y;
  const cx = c.x - a.x;
  const cy = c.y - a.y;
  const bb = bx * bx + by * by;
  const cc = cx * cx + cy * cy;
  const determinant = 2 * (bx * cy - by * cx);
  const longestSideSquared = Math.max(bb, cc, (bx - cx) ** 2 + (by - cy) ** 2);
  if (Math.abs(determinant) <= RELATIVE_DISTANCE * longestSideSquared * 2) return null;
  const x = (bb * cy - cc * by) / determinant;
  const y = (cc * bx - bb * cx) / determinant;
  const circle = { centerX: a.x + x, centerY: a.y + y, radius: Math.hypot(x, y) };
  return Object.values(circle).every(Number.isFinite) ? circle : null;
};

const geometryPoints = (graph: DependencyGraph): GeometryPoint[] => graph.nodes
  .filter((node): node is GraphNode & { coordinates: PointCoordinate } => !node.isSentinel && node.coordinates !== undefined && Number.isFinite(node.coordinates.x) && Number.isFinite(node.coordinates.y))
  .map((node) => ({ name: node.name, coordinates: node.coordinates }));

export const detectGeometryRelations = (graph: DependencyGraph, computedAt = Date.now()): GeometryRelationResult => {
  const diagnostics: string[] = [];
  const input = geometryPoints(graph);
  const { points, scale } = preparePoints(input, diagnostics);
  // All predicates run in the same translated, normalized coordinate frame.
  const tolerance = buildTolerance();
  const pairs: PointPair[] = [];
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const dx = points[right].coordinates.x - points[left].coordinates.x;
      const dy = points[right].coordinates.y - points[left].coordinates.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length <= tolerance.minimumLength) continue;
      const angle = normalizeAngle(Math.atan2(dy, dx));
      pairs.push({ left, right, angle, length });
    }
  }

  const directionSet = clusterByBuckets(pairs.map((pair) => pair.angle), tolerance.angular, Math.PI, (left, right) => circularDistance(left, right, Math.PI) <= tolerance.angular);
  const directionGroups = [...directionSet.groups().entries()].map(([root, indexes]) => ({ root, pairs: indexes.map((index) => pairs[index]) }));
  const lineGroups = directionGroups.flatMap(({ root, pairs: directionPairs }) => groupLinePairs(directionPairs, root, tolerance, points));
  const directionFamilies = directionGroups.flatMap(({ root, pairs: directionPairs }) => {
    const angle = directionPairs[0].angle;
    // A transitive angular cluster can drift beyond the intended tolerance.
    if (!directionPairs.every((pair) => circularDistance(pair.angle, angle, Math.PI) <= tolerance.angular)) return [];
    const lines = lineGroups.filter((line) => line.directionRoot === root);
    // Distinct parallel lines cannot share a point. Nearly parallel rays that
    // failed the incidence check are too ambiguous to form a direction family.
    const stableLines = lines.filter((line) => !lines.some((other) => other !== line && [...line.points].some((index) => other.points.has(index))));
    return [{ root, angle, lines: stableLines }];
  });
  const relationSeeds: RelationSeed[] = [];

  lineGroups.forEach((line) => {
    const names = linePointNames(line, points);
    if (line.points.size >= 3) relationSeeds.push({ key: `collinear:${names.join('|')}`, kind: 'collinear', witness: { points: names.slice(0, MAX_WITNESSES), lineFamilies: [[names]] }, points: line.points, confidence: Math.min(1, 0.75 + (line.points.size - 3) * 0.05) });
  });

  directionFamilies.forEach(({ root: directionRoot, lines: family }) => {
    if (family.length < 2) return;
    const pointsInFamily = new Set(family.flatMap((line) => [...line.points]));
    relationSeeds.push({ key: `parallel:${directionRoot}`, kind: 'parallel', witness: { points: [...pointsInFamily].map((index) => points[index].name), lineFamilies: [lineFamilyNames(family, points)] }, points: pointsInFamily, confidence: 0.98 });
  });

  directionFamilies.forEach((left, leftIndex) => {
    directionFamilies.slice(leftIndex + 1).forEach((right) => {
      if (circularDistance(left.angle - right.angle, Math.PI / 2, Math.PI) > tolerance.angular) return;
      const leftLines = left.lines;
      const rightLines = right.lines;
      if (leftLines.length === 0 || rightLines.length === 0) return;
      const pointsInFamily = new Set([...leftLines, ...rightLines].flatMap((line) => [...line.points]));
      relationSeeds.push({ key: `perpendicular:${Math.min(left.root, right.root)}:${Math.max(left.root, right.root)}`, kind: 'perpendicular', witness: { points: [...pointsInFamily].map((index) => points[index].name), lineFamilies: [lineFamilyNames(leftLines, points), lineFamilyNames(rightLines, points)] }, points: pointsInFamily, confidence: 0.98 });
    });
  });

  const circles: CircleCandidate[] = [];
  let stopped = false;
  for (let a = 0; a < points.length && !stopped; a += 1) {
    for (let b = a + 1; b < points.length && !stopped; b += 1) {
      for (let c = b + 1; c < points.length; c += 1) {
        if (circles.length >= MAX_CIRCLE_CANDIDATES) { stopped = true; break; }
        const circle = createCircle(points[a].coordinates, points[b].coordinates, points[c].coordinates);
        if (circle) circles.push({ ...circle, points: [a, b, c] });
      }
    }
  }
  if (stopped) diagnostics.push(`Circle candidate limit (${MAX_CIRCLE_CANDIDATES}) reached; further candidates were skipped.`);
  const circleSet = new DisjointSet(circles.length);
  const buckets = new Map<string, number[]>();
  const MAX_BUCKET_REPRESENTATIVES = 8;
  const bucketSize = Math.max(tolerance.circleCenter, tolerance.circleRadius);
  circles.forEach((circle, index) => {
    const base = [Math.floor(circle.centerX / bucketSize), Math.floor(circle.centerY / bucketSize), Math.floor(circle.radius / bucketSize)];
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (let dr = -1; dr <= 1; dr += 1) {
      const key = `${base[0] + dx}:${base[1] + dy}:${base[2] + dr}`;
      (buckets.get(key) ?? []).slice(0, MAX_BUCKET_REPRESENTATIVES).forEach((candidateIndex) => {
        const candidate = circles[candidateIndex];
        if (Math.hypot(circle.centerX - candidate.centerX, circle.centerY - candidate.centerY) <= tolerance.circleCenter && Math.abs(circle.radius - candidate.radius) <= tolerance.circleRadius) circleSet.union(index, candidateIndex);
      });
    }
    const ownKey = `${base[0]}:${base[1]}:${base[2]}`;
    const representatives = buckets.get(ownKey) ?? [];
    if (representatives.length < MAX_BUCKET_REPRESENTATIVES) buckets.set(ownKey, [...representatives, index]);
  });
  [...circleSet.groups().values()].forEach((indexes) => {
    const pointSet = new Set(indexes.flatMap((index) => circles[index].points));
    const circle = circles[indexes[0]];
    // Bucket clustering is only a candidate search, not an incidence proof.
    if (![...pointSet].every((index) => Math.abs(Math.hypot(points[index].coordinates.x - circle.centerX, points[index].coordinates.y - circle.centerY) - circle.radius) <= tolerance.circleRadius)) return;
    if (pointSet.size >= 4) {
      const names = [...pointSet].map((index) => points[index].name);
      relationSeeds.push({ key: `concyclic:${[...names].sort().join('|')}`, kind: 'concyclic', witness: { points: names.slice(0, MAX_WITNESSES) }, points: pointSet, confidence: Math.min(1, 0.85 + (pointSet.size - 4) * 0.03) });
    }
  });

  const profile = buildDependencyProfile(graph);
  const relations = new Map<string, GeometryRelation>();
  const aliases = new Map(points.map((point) => [point.name, point.aliases]));
  const expandNames = (names: readonly string[]): string[] => names.flatMap((name) => aliases.get(name) ?? [name]);
  relationSeeds.forEach((seed) => {
    const pointNames = [...seed.points].flatMap((index) => points[index].aliases).sort();
    const id = seed.key;
    const representativeNames = [...new Set(seed.witness.points)].sort();
    const metric = measureDependencySeparation(profile, representativeNames);
    const witness: RelationWitness = {
      ...seed.witness,
      points: expandNames(representativeNames).sort(),
      lineFamilies: seed.witness.lineFamilies?.map((family) => family.map(expandNames)),
    };
    const relation: GeometryRelation = { id, kind: seed.kind, pointNames, witnesses: [witness], confidence: seed.confidence, nonTriviality: scoreDependencySeparation(metric), explanation: explainDependencySeparation(metric), metric };
    const existing = relations.get(id);
    if (existing) {
      existing.witnesses = [...existing.witnesses, witness].slice(0, MAX_WITNESSES);
      existing.confidence = Math.max(existing.confidence, relation.confidence);
    } else relations.set(id, relation);
  });

  const sortedRelations = [...relations.values()].sort((left, right) => right.nonTriviality - left.nonTriviality || right.confidence - left.confidence || RELATION_ORDER.indexOf(left.kind) - RELATION_ORDER.indexOf(right.kind) || left.id.localeCompare(right.id));
  return { relations: sortedRelations, pointCount: points.reduce((count, point) => count + point.aliases.length, 0), tolerance: buildTolerance(scale), diagnostics, computedAt };
};
