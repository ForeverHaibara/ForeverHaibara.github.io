import type { AdvancedCommand } from '../advancedCommands';
import { loadTriangleCenterCatalogue, requiresTriangleCenterRecipe } from '../custom/builders/triangleCenters';
import { createCenterEvaluator, type Point } from './triangleCenterNumerics';
export const nearestTriangleCenter: AdvancedCommand = {
  name: 'nearestTriangleCenter',
  description: 'Find the closest finite native or extended triangle center to P. Returns a coordinate snapshot without creating objects; equal distances prefer the smaller ID.',
  signatures: ['nearestTriangleCenter(A: point, B: point, C: point, P: point)'],
  async execute(engine, args) {
    if (args.length !== 4 || args.some((arg) => typeof arg !== 'string' || !arg.trim())) {
      throw new Error('Use !nearestTriangleCenter(A,B,C,P) with four existing 2D point names.');
    }
    const points: Point[] = [];
    for (const name of args as string[]) {
      const type = await engine.callApi('getObjectType', [name]);
      if (type !== 'point' || await engine.callApi('isDefined', [name]) !== true) {
        throw new Error(`${name} must be a defined 2D point.`);
      }
      const x = await engine.callApi('getXcoord', [name]), y = await engine.callApi('getYcoord', [name]);
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`${name} must have finite coordinates.`);
      }
      points.push([x, y]);
    }
    const origin = points[0];
    const scale = Math.max(...points.slice(0, 3).flatMap((p) => [Math.abs(p[0] - origin[0]), Math.abs(p[1] - origin[1])]));
    if (!Number.isFinite(scale) || scale === 0)
      throw new Error('A, B, C must form a nondegenerate triangle.');
    const normalized = points.map((p) => [(p[0] - origin[0]) / scale, (p[1] - origin[1]) / scale] as Point);
    const [a, b, c, p] = normalized;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) <= 1e-14)
      throw new Error('A, B, C must form a nondegenerate triangle.');
    const catalogue = await loadTriangleCenterCatalogue();
    const native = new Map<number, Point>();
    const vertices = normalized.slice(0, 3).map(([x, y]) => `(${x},${y})`).join(',');
    // getValue evaluates numeric expressions anonymously. Never evalCommand or assign
    // a label: all calculations use the snapshot, not live construction dependencies.
    for (let id = 1; id <= 3053; id++) {
      if (!requiresTriangleCenterRecipe(id) && !catalogue.nativeDirections.has(id)) {
        const center = `TriangleCenter(${vertices},${id})`;
        // The guard also distinguishes undefined centers from API fallback zero.
        const x = await engine.callApi('getValue', [`If(IsDefined(${center}),x(${center}),0/0)`]);
        const y = await engine.callApi('getValue', [`If(IsDefined(${center}),y(${center}),0/0)`]);
        if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y))
          native.set(id, [x, y]);
      }
      if (id % 100 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const evaluate = createCenterEvaluator(normalized.slice(0, 3), catalogue, native);
    const ids = [...new Set([...Array.from({ length: 3053 }, (_, i) => i + 1), ...catalogue.recipes.keys()])].sort((a, b) => a - b);
    let best: {
      id: number;
      point: Point;
      distance: number;
    } | undefined;
    let evaluated = 0;
    for (let i = 0; i < ids.length; i++) {
      const point = evaluate(ids[i]);
      if (point) {
        const distance = Math.hypot(point[0] - p[0], point[1] - p[1]);
        if (Number.isFinite(distance)) {
          evaluated++;
          if (!best || distance < best.distance)
            best = { id: ids[i], point, distance };
        }
      }
      if (i % 1000 === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (!best)
      throw new Error('No finite triangle center is defined for this triangle.');
    return { id: best.id, center: `X(${best.id})`,
      point: { x: origin[0] + best.point[0] * scale, y: origin[1] + best.point[1] * scale },
      distance: best.distance * scale, evaluated, skipped: ids.length - evaluated };
  },
};
