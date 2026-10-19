import type { GeometryScene } from '../scene/geometryScene';

export const segmentId = (a: number, b: number): string => `s:${Math.min(a, b)}:${Math.max(a, b)}`;

/** The shared positive multiplicative domain excludes self/zero distances. */
export const positiveLengthPairs = (scene: GeometryScene) => {
  const seen = new Set<string>();
  return scene.pairs.flatMap((pair) => {
    const left = scene.points[pair.left]; const right = scene.points[pair.right];
    if (!left || !right || pair.left === pair.right || left.name === right.name) return [];
    const length = Math.hypot(right.coordinates.x - left.coordinates.x, right.coordinates.y - left.coordinates.y);
    const id = segmentId(pair.left, pair.right);
    if (!Number.isFinite(length) || length <= scene.tolerance.minimumLength || seen.has(id)) return [];
    seen.add(id);
    return [{ ...pair, length, id, value: Math.log(length) }];
  });
};
export type PositiveLength = ReturnType<typeof positiveLengthPairs>[number];
