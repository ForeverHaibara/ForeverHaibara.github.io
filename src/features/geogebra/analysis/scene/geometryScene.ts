import { groupCircularValues, circularDistance } from '../equivalence';
import type { DependencyGraph, GraphNode, PointCoordinate } from '../graphTypes';
import type { GeometryPoint, GeometryTolerance } from '../geometryTypes';
import { cross, dot } from '../quantities/vector';

export interface PointPair {
  left: number;
  right: number;
  angle: number;
  length: number;
}

export interface LineGroup {
  directionRoot: number;
  points: Set<number>;
  pairs: PointPair[];
}

export interface CircleCandidate {
  centerX: number;
  centerY: number;
  radius: number;
  points: [number, number, number];
}

export interface AnalysisPoint extends GeometryPoint {
  aliases: string[];
}

export const RELATIVE_DISTANCE = 2e-7;
// Beyond this dynamic range, directions to a distant point cannot reliably
// distinguish points in the main construction at our angular tolerance.
const MAX_NORMALIZED_COORDINATE = 1 / RELATIVE_DISTANCE;

const normalizeAngle = (angle: number): number => {
  const normalized = angle % Math.PI;
  return normalized < 0 ? normalized + Math.PI : normalized;
};

export const buildTolerance = (scale = 1): GeometryTolerance => ({
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

export const linePointNames = (line: LineGroup, points: readonly GeometryPoint[]): string[] => linePointIndexes(line, points).map((index) => points[index].name);

export const lineFamilyNames = (lines: readonly LineGroup[], points: readonly GeometryPoint[]): string[][] => lines.map((line) => linePointNames(line, points));

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

export const createCircle = (a: PointCoordinate, b: PointCoordinate, c: PointCoordinate): { centerX: number; centerY: number; radius: number } | null => {
  const bx = b.x - a.x;
  const by = b.y - a.y;
  const cx = c.x - a.x;
  const cy = c.y - a.y;
  const bb = dot({ x: bx, y: by }, { x: bx, y: by });
  const cc = dot({ x: cx, y: cy }, { x: cx, y: cy });
  const determinant = 2 * cross({ x: bx, y: by }, { x: cx, y: cy });
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

export const buildGeometryScene = (graph: DependencyGraph, diagnostics: string[], maxPairs = 20000) => {
  const input = geometryPoints(graph);
  const { points, scale } = preparePoints(input, diagnostics);
  // All predicates run in the same translated, normalized coordinate frame.
  const tolerance = buildTolerance();
  const pairs: PointPair[] = [];
  pairLoop: for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (pairs.length >= maxPairs) { diagnostics.push(`Point pair limit (${maxPairs}) reached; results are partial.`); break pairLoop; }
      const dx = points[right].coordinates.x - points[left].coordinates.x;
      const dy = points[right].coordinates.y - points[left].coordinates.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length <= tolerance.minimumLength) continue;
      const angle = normalizeAngle(Math.atan2(dy, dx));
      pairs.push({ left, right, angle, length });
    }
  }

  const directionGroups = groupCircularValues(pairs.map((pair) => pair.angle), tolerance.angular, Math.PI)
    .map((indexes) => ({ root: Math.min(...indexes), pairs: indexes.map((index) => pairs[index]) }));
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
  const directionFrames = groupCircularValues(directionFamilies.map((family) => family.angle), tolerance.angular, Math.PI / 2);
  return { input, points, scale, tolerance, pairs, lineGroups, directionFamilies, directionFrames };
};

export type GeometryScene = ReturnType<typeof buildGeometryScene>;
