import type { GeometryScene } from './geometryScene';
import { segmentId } from '../quantities/lengths';

export interface RayClass { endpoint: number; endpoints: number[]; }
/** Quotient by an observed carrier AND a checked ray direction. A common line
 * never identifies opposite rays, nor short near-parallel rays with bad angles. */
export const buildRayClasses = (scene: GeometryScene, carriers: ReadonlyMap<string, { id: string; angle: number }>): RayClass[][] => {
  const rays = scene.points.map(() => new Map<string, RayClass[]>());
  const sorted = [...scene.pairs].sort((a, b) => {
    const key = (pair: typeof a) => [scene.points[pair.left].name, scene.points[pair.right].name].sort().join('|');
    return key(a).localeCompare(key(b));
  });
  for (const pair of sorted) {
    const carrier = carriers.get(segmentId(pair.left, pair.right));
    if (!carrier) continue;
    for (const [vertex, endpoint] of [[pair.left, pair.right], [pair.right, pair.left]]) {
      const origin = scene.points[vertex].coordinates;
      const p = scene.points[endpoint].coordinates;
      const x = p.x - origin.x; const y = p.y - origin.y;
      const phase = x * Math.cos(carrier.angle) + y * Math.sin(carrier.angle) > 0 ? 1 : -1;
      const key = `${carrier.id}:${phase}`;
      const groups = rays[vertex].get(key) ?? [];
      const group = groups.find((candidate) => {
        const anchor = scene.points[candidate.endpoint].coordinates;
        const u = anchor.x - origin.x; const v = anchor.y - origin.y;
        return u * x + v * y > 0 && Math.abs(u * y - v * x) <= scene.tolerance.angular * Math.hypot(u, v) * pair.length;
      });
      if (group) group.endpoints.push(endpoint); else groups.push({ endpoint, endpoints: [endpoint] });
      rays[vertex].set(key, groups);
    }
  }
  return rays.map((groups) => [...groups.values()].flat().sort((a, b) => scene.points[a.endpoint].name.localeCompare(scene.points[b.endpoint].name)));
};

/** Round-robin vertices rather than exhausting one star before the next. */
export function* rayAngleCandidates(rays: RayClass[][], order: number[]) {
  function* pairs(vertex: number) {
    const star = rays[vertex];
    for (let span = 1; span < star.length; span += 1) for (let start = 0; start + span < star.length; start += 1)
      yield { vertex, firstRay: star[start], secondRay: star[start + span] };
  }
  let active = order.map(pairs);
  while (active.length > 0) {
    const remaining: typeof active = [];
    for (const iterator of active) {
      const next = iterator.next();
      if (!next.done) { yield next.value; remaining.push(iterator); }
    }
    active = remaining;
  }
}
