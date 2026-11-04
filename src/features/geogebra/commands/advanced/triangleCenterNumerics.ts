import { formula } from './coordinateFormula';
import type { loadTriangleCenterCatalogue } from '../custom/builders/triangleCenters';
export type Point = readonly [number, number];
type Value = {
  point: Point;
  ideal?: boolean;
};
type Catalogue = Awaited<ReturnType<typeof loadTriangleCenterCatalogue>>;
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rotation: Record<string, string> = { a: 'b', b: 'c', c: 'a', A: 'B', B: 'C', C: 'A', x: 'y', y: 'z', z: 'x', u: 'v', v: 'w', w: 'u', sa: 'sb', sb: 'sc', sc: 'sa', SA: 'SB', SB: 'SC', SC: 'SA' };
const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const homogeneous = (v: Value) => [...v.point, v.ideal ? 0 : 1];
const affine = (v: readonly number[]): Value => ({ point: [v[0] / v[2], v[1] / v[2]] });
const line = (p: Value, q: Value) => cross(homogeneous(p), homogeneous(q));
const finite = (v: Value): Point => v.ideal ? [NaN, NaN] : v.point;
const circleCenter = ([p, q, r]: Point[]): Point => {
  const u = [q[0] - p[0], q[1] - p[1]], v = [r[0] - p[0], r[1] - p[1]];
  const d = 2 * (u[0] * v[1] - u[1] * v[0]);
  const u2 = u[0] ** 2 + u[1] ** 2, v2 = v[0] ** 2 + v[1] ** 2;
  return [p[0] + (u2 * v[1] - v2 * u[1]) / d, p[1] + (u[0] * v2 - v[0] * u2) / d];
};
/** Per-search memoization includes undefined results and directed ideal dependencies. */
export const createCenterEvaluator = (vertices: Point[], catalogue: Catalogue, native: ReadonlyMap<number, Point>) => {
  const [a, b, c] = [distance(vertices[1], vertices[2]), distance(vertices[2], vertices[0]), distance(vertices[0], vertices[1])];
  const s = (a + b + c) / 2;
  const S = Math.abs((vertices[1][0] - vertices[0][0]) * (vertices[2][1] - vertices[0][1]) - (vertices[1][1] - vertices[0][1]) * (vertices[2][0] - vertices[0][0]));
  const SA = (b * b + c * c - a * a) / 2, SB = (c * c + a * a - b * b) / 2, SC = (a * a + b * b - c * c) / 2;
  const angle = (n: number, d: number) => Math.acos(Math.max(-1, Math.min(1, n / d)));
  const E = (a * b * c / S) ** 2, SW = (a * a + b * b + c * c) / 2;
  const scope = { a, b, c, s, S, SA, SB, SC, SW, E, F: SW - E, sa: s - a, sb: s - b, sc: s - c, r: S / (a + b + c), R: a * b * c / (2 * S), pi: Math.PI,
    A: angle(SA, b * c), B: angle(SB, c * a), C: angle(SC, a * b) };
  const areas = (v: Value) => vertices.map((_, i) => {
    const p = vertices[(i + 1) % 3], q = vertices[(i + 2) % 3], [x, y] = v.point;
    return v.ideal ? x * (p[1] - q[1]) - y * (p[0] - q[0]) : (p[0] - x) * (q[1] - y) - (p[1] - y) * (q[0] - x);
  });
  const weighted = (weights: number[], points = vertices): Value => {
    const scale = Math.max(...weights.map(Math.abs));
    const w = weights.map((n) => n / scale), sum = w.reduce((t, n) => t + n, 0);
    if (Math.abs(sum) <= 1e-14 * w.reduce((t, n) => t + Math.abs(n), 0))
      return { point: [NaN, NaN] };
    return { point: [0, 1].map((axis) => w.reduce((t, n, i) => t + n * points[i][axis], 0) / sum) as [number, number] };
  };
  const cyclic = (source: string, extra: Record<string, number> = {}) => [0, 1, 2].map((turn) => {
    const rotated = source.replace(/[A-Za-z_]+/gu, (name) => { for (let i = 0; i < turn; i++)
      name = rotation[name] ?? name; return name; });
    return formula(rotated)({ ...scope, ...extra });
  });
  const memo = new Map<number, Value | null>();
  const visiting = new Set<number>();
  const evaluate = (id: number): Value | null => {
    if (memo.has(id))
      return memo.get(id)!;
    if (visiting.has(id))
      throw new Error(`Cyclic center X(${id})`);
    visiting.add(id);
    let result: Value | null = null;
    try {
      const recipe = catalogue.recipes.get(id), direction = catalogue.nativeDirections.get(id);
      if (!recipe && direction) {
        const first = evaluate(direction[0]), second = evaluate(direction[1]);
        if (!first || !second)
          return null;
        const p = finite(first), q = finite(second);
        result = { point: [q[0] - p[0], q[1] - p[1]], ideal: true };
      }
      else if (!recipe)
        result = native.has(id) ? { point: native.get(id)! } : null;
      else {
        const values = recipe.references.map((ref) => evaluate(ref));
        if (values.some((v) => !v))
          return null;
        const vs = values as Value[], op = recipe.operation;
        const pts = () => vs.map(finite);
        if (op === 'I') {
          if (vs.length) {
            const [p, q] = pts();
            result = { point: [q[0] - p[0], q[1] - p[1]], ideal: true };
          }
        }
        else if (op === 'B') {
          const extra = Object.fromEntries(vs.flatMap((v, i) => areas(v).map((n, j) => [['x', 'y', 'z', 'u', 'v', 'w'][3 * i + j], n])));
          if (recipe.formula!.startsWith('@g')) {
            const template = catalogue.geminiTriangles.get(Number(recipe.formula!.slice(2)))!;
            const cols = [0, 1, 2].map((turn) => template.map((_, i) => cyclic(template[(i - turn + 3) % 3])[turn]));
            const normalized = cols.map((col) => { const norm = col.reduce((t, n) => t + Math.abs(n), 0); return col.map((n) => n / norm); });
            const [u, v, w] = normalized, determinant = u.reduce((t, n, i) => t + n * cross(v, w)[i], 0);
            if (Math.abs(determinant) <= 1e-12)
              return null;
            const rows = [cross(v, w), cross(w, u), cross(u, v)];
            const d = rows.map((row) => row.reduce((t, n) => t + n, 0));
            if (d.some((n, i) => Math.abs(n) <= 1e-12 * rows[i].reduce((t, v) => t + Math.abs(v), 0)))
              return null;
            result = weighted([0, 1, 2].map((i) => normalized.reduce((t, col, j) => t + col[i] * [extra.x, extra.y, extra.z][j] * d[j], 0)));
          }
          else {
            if (vs.some((v) => v.ideal) && !(vs.length === 1 && ['x^2', 'x^3'].includes(recipe.formula!)))
              return null;
            result = weighted(cyclic(recipe.formula!, extra));
          }
        }
        else if (op === 'F') {
          const points = pts(), d = points.length === 2 ? distance(points[0], points[1]) : NaN;
          result = weighted(recipe.formula!.split('|').map((f) => formula(f)({ ...scope, d })), points);
        }
        else if (op === 'J')
          result = affine(cross(line(vs[0], vs[1]), line(vs[2], vs[3])));
        else if (op === 'G' || op === 'T') {
          const w = areas(vs[0]);
          result = weighted(w.map((_, i) => w[(i + 1) % 3] * w[(i + 2) % 3] * (op === 'G' ? [a * a, b * b, c * c][i] : 1)));
        }
        else if (op === 'O')
          result = { point: circleCenter(pts()) };
        else if (op === 'P' || op === 'R' && vs.length === 3) {
          const p = finite(vs[0]), l = line(vs[1], vs[2]), norm = l[0] ** 2 + l[1] ** 2;
          const t = (l[0] * p[0] + l[1] * p[1] + l[2]) / norm * (op === 'R' ? 2 : 1);
          result = { point: [p[0] - t * l[0], p[1] - t * l[1]] };
        }
        else if (op === 'V') {
          const points = pts(), p = points[0], center = points.length === 3 ? points[1] : circleCenter(vertices);
          const radius = distance(center, points.length === 3 ? points[2] : vertices[0]);
          const factor = (radius / distance(p, center)) ** 2;
          result = { point: [center[0] + factor * (p[0] - center[0]), center[1] + factor * (p[1] - center[1])] };
        }
        else {
          const [p, q] = pts();
          result = { point: [0, 1].map((i) => op === 'M' ? (p[i] + q[i]) / 2 : op === 'R' ? 2 * q[i] - p[i]
              : op === 'C' ? (vertices.reduce((t, v) => t + v[i], 0) - p[i]) / 2 : vertices.reduce((t, v) => t + v[i], 0) - 2 * p[i]) as [number, number] };
        }
      }
      if (result && (!result.point.every(Number.isFinite) || result.ideal && Math.hypot(...result.point) === 0))
        result = null;
      return result;
    }
    finally {
      visiting.delete(id);
      memo.set(id, result);
    }
  };
  return (id: number): Point | null => { const value = evaluate(id); return value && !value.ideal ? value.point : null; };
};
