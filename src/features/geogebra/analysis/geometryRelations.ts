import { clusterByBuckets, circularDistance, DisjointSet } from './equivalence';
import { buildDependencyProfile, explainDependencySeparation, measureDependencySeparation, scoreDependencySeparation } from './dependencyMetric';
import type { DependencyGraph, GraphNode, PointCoordinate } from './graphTypes';
import type { GeometryPoint, GeometryRelation, GeometryRelationKind, GeometryRelationResult, GeometryTolerance, RelationWitness } from './geometryTypes';

interface PointPair {
  left: number;
  right: number;
  angle: number;
  length: number;
  offset: number;
}

interface LineGroup {
  directionRoot: number;
  points: Set<number>;
  pairs: PointPair[];
  offset: number;
}

interface CircleCandidate {
  centerX: number;
  centerY: number;
  radius: number;
  points: [number, number, number];
}

const RELATION_ORDER: GeometryRelationKind[] = ['concyclic', 'perpendicular', 'parallel', 'collinear'];
const MAX_WITNESSES = 8;
const MAX_CIRCLE_CANDIDATES = 8000;

const normalizeAngle = (angle: number): number => {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
};

const buildTolerance = (points: readonly GeometryPoint[]): GeometryTolerance => {
  if (points.length === 0) return { scale: 1, distance: 1e-8, angular: 1e-7, lineOffset: 1e-8, circleCenter: 1e-7, circleRadius: 1e-7, minimumLength: 1e-7 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxAbs = 1;
  points.forEach(({ coordinates }) => {
    minX = Math.min(minX, coordinates.x);
    minY = Math.min(minY, coordinates.y);
    maxX = Math.max(maxX, coordinates.x);
    maxY = Math.max(maxY, coordinates.y);
    maxAbs = Math.max(maxAbs, Math.abs(coordinates.x), Math.abs(coordinates.y));
  });
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  const scale = Math.max(1, maxAbs, diagonal);
  const distanceTolerance = Math.max(1e-8, scale * 2e-7);
  return {
    scale,
    distance: distanceTolerance,
    angular: Math.max(1e-7, Math.min(2e-4, distanceTolerance / Math.max(diagonal, 1))),
    lineOffset: distanceTolerance * 2,
    circleCenter: distanceTolerance * 3,
    circleRadius: distanceTolerance * 3,
    minimumLength: Math.max(1e-7, distanceTolerance * 0.5),
  };
};

const pointsFromPairs = (pairs: readonly PointPair[]): Set<number> => new Set(pairs.flatMap((pair) => [pair.left, pair.right]));

const groupLinePairs = (pairs: readonly PointPair[], directionRoot: number, tolerance: GeometryTolerance): LineGroup[] => {
  const lineSet = new DisjointSet(pairs.length);
  for (let left = 0; left < pairs.length; left += 1) {
    for (let right = left + 1; right < pairs.length; right += 1) {
      if (Math.abs(pairs[left].offset - pairs[right].offset) <= tolerance.lineOffset) lineSet.union(left, right);
    }
  }
  return [...lineSet.groups().values()].map((indexes) => {
    const groupPairs = indexes.map((index) => pairs[index]);
    return { directionRoot, points: pointsFromPairs(groupPairs), pairs: groupPairs, offset: groupPairs.reduce((sum, pair) => sum + pair.offset, 0) / groupPairs.length };
  }).filter((group) => group.points.size >= 2);
};

const pairWitness = (left: LineGroup, right: LineGroup): RelationWitness | null => {
  for (const leftPair of left.pairs) {
    for (const rightPair of right.pairs) {
      const points = [leftPair.left, leftPair.right, rightPair.left, rightPair.right];
      if (new Set(points).size === 4) return { points: points.map(String), segments: [[String(leftPair.left), String(leftPair.right)], [String(rightPair.left), String(rightPair.right)]] };
    }
  }
  return null;
};

const createCircle = (a: PointCoordinate, b: PointCoordinate, c: PointCoordinate): { centerX: number; centerY: number; radius: number } | null => {
  const determinant = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(determinant) < 1e-14) return null;
  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;
  const centerX = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / determinant;
  const centerY = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / determinant;
  return { centerX, centerY, radius: Math.hypot(centerX - a.x, centerY - a.y) };
};

const geometryPoints = (graph: DependencyGraph): GeometryPoint[] => graph.nodes
  .filter((node): node is GraphNode & { coordinates: PointCoordinate } => !node.isSentinel && node.coordinates !== undefined && Number.isFinite(node.coordinates.x) && Number.isFinite(node.coordinates.y))
  .map((node) => ({ name: node.name, coordinates: node.coordinates }));

const relationId = (kind: GeometryRelationKind, points: readonly string[]): string => `${kind}:${[...points].sort().join('|')}`;

export const detectGeometryRelations = (graph: DependencyGraph, computedAt = Date.now()): GeometryRelationResult => {
  const points = geometryPoints(graph);
  const tolerance = buildTolerance(points);
  const diagnostics: string[] = [];
  const pairs: PointPair[] = [];
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const dx = points[right].coordinates.x - points[left].coordinates.x;
      const dy = points[right].coordinates.y - points[left].coordinates.y;
      const length = Math.hypot(dx, dy);
      if (length < tolerance.minimumLength) continue;
      const angle = normalizeAngle(Math.atan2(dy, dx));
      pairs.push({ left, right, angle, length, offset: -Math.sin(angle) * points[left].coordinates.x + Math.cos(angle) * points[left].coordinates.y });
    }
  }

  const directionSet = clusterByBuckets(pairs.map((pair) => pair.angle), tolerance.angular, Math.PI, (left, right) => circularDistance(left, right, Math.PI) <= tolerance.angular);
  const directionGroups = [...directionSet.groups().entries()].map(([root, indexes]) => ({ root, pairs: indexes.map((index) => pairs[index]) }));
  const lineGroups = directionGroups.flatMap(({ root, pairs: directionPairs }) => groupLinePairs(directionPairs, root, tolerance));
  const relationSeeds: Array<{ kind: GeometryRelationKind; witness: RelationWitness; points: Set<number>; confidence: number }> = [];

  lineGroups.forEach((line, lineIndex) => {
    if (line.points.size >= 3) relationSeeds.push({ kind: 'collinear', witness: { points: [...line.points].slice(0, MAX_WITNESSES).map((index) => points[index].name) }, points: line.points, confidence: Math.min(1, 0.75 + (line.points.size - 3) * 0.05) });
    lineGroups.slice(lineIndex + 1).forEach((other) => {
      if (line.directionRoot !== other.directionRoot) return;
      const witness = pairWitness(line, other);
      if (witness) relationSeeds.push({ kind: 'parallel', witness: { ...witness, points: witness.points.map((index) => points[Number(index)].name) }, points: new Set([...line.points, ...other.points]), confidence: 0.98 });
    });
  });

  directionGroups.forEach((left, leftIndex) => {
    directionGroups.slice(leftIndex + 1).forEach((right) => {
      if (circularDistance(left.pairs[0].angle - right.pairs[0].angle, Math.PI / 2, Math.PI) > tolerance.angular) return;
      const leftLines = lineGroups.filter((line) => line.directionRoot === left.root);
      const rightLines = lineGroups.filter((line) => line.directionRoot === right.root);
      for (const leftLine of leftLines) {
        for (const rightLine of rightLines) {
          const witness = pairWitness(leftLine, rightLine);
          if (witness) {
            relationSeeds.push({ kind: 'perpendicular', witness: { ...witness, points: witness.points.map((index) => points[Number(index)].name) }, points: new Set([...leftLine.points, ...rightLine.points]), confidence: 0.98 });
            return;
          }
        }
      }
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
  if (stopped) diagnostics.push(`共圆候选数量超过 ${MAX_CIRCLE_CANDIDATES}，已限制计算规模。`);
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
    if (pointSet.size >= 4) relationSeeds.push({ kind: 'concyclic', witness: { points: [...pointSet].slice(0, MAX_WITNESSES).map((index) => points[index].name) }, points: pointSet, confidence: Math.min(1, 0.85 + (pointSet.size - 4) * 0.03) });
  });

  const profile = buildDependencyProfile(graph);
  const relations = new Map<string, GeometryRelation>();
  relationSeeds.forEach((seed) => {
    const pointNames = [...seed.points].map((index) => points[index].name).sort();
    const id = relationId(seed.kind, pointNames);
    const witness = { ...seed.witness, points: [...new Set(seed.witness.points)].sort() };
    const metric = measureDependencySeparation(profile, witness.points);
    const relation: GeometryRelation = { id, kind: seed.kind, pointNames, witnesses: [witness], confidence: seed.confidence, nonTriviality: scoreDependencySeparation(metric), explanation: explainDependencySeparation(metric), metric };
    const existing = relations.get(id);
    if (existing) {
      existing.witnesses = [...existing.witnesses, witness].slice(0, MAX_WITNESSES);
      existing.confidence = Math.max(existing.confidence, relation.confidence);
    } else relations.set(id, relation);
  });

  const sortedRelations = [...relations.values()].sort((left, right) => right.nonTriviality - left.nonTriviality || right.confidence - left.confidence || RELATION_ORDER.indexOf(left.kind) - RELATION_ORDER.indexOf(right.kind) || left.id.localeCompare(right.id));
  return { relations: sortedRelations, pointCount: points.length, tolerance, diagnostics, computedAt };
};
