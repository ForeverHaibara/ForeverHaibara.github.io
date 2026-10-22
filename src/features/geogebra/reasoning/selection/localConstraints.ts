import { SAMPLE_EPSILON } from '../../analysis/numericPrecision';
import type { PointCoordinate } from '../../analysis/graphTypes';
import type { GeometryPredicate, ReasoningObject, Segment } from '../ir/types';
import { predicatePoints } from '../ir/types';
import { directedAngleValue, wrapHalfTurns } from '../../analysis/quantities/directedAngles';
import { evaluateProductEquation } from '../../geometry/vectorProducts';

export type Gradient = [number, number];
export interface ConstraintAssessment { gradients: Gradient[]; residual: number; }
const cross = (a: PointCoordinate, b: PointCoordinate) => a.x * b.y - a.y * b.x;
const delta = (a: PointCoordinate, b: PointCoordinate) => ({ x: a.x - b.x, y: a.y - b.y });
const norm = (a: PointCoordinate) => Math.hypot(a.x, a.y);
const wrap = wrapHalfTurns;

/** Finite-difference rank is local geometric evidence, never a logical certificate. */
export const assessLocalConstraint = (predicate: GeometryPredicate, objectId: string, objects: readonly ReasoningObject[], differentiate = true): ConstraintAssessment | null => {
  const ids = new Set(predicatePoints(predicate));
  const used = objects.filter((object) => ids.has(object.id));
  if (used.length !== ids.size || used.some((object) => !object.coordinates)) return null;
  const origin = used[0].coordinates!;
  const scale = Math.max(...used.map((object) => norm(delta(object.coordinates!, origin))));
  if (!Number.isFinite(scale) || scale < 1e-12) return scale === 0 && ids.has(objectId) && predicate.kind === 'coincident'
    ? { gradients: [[1, 0], [0, 1]], residual: 0 } : null;
  const points = new Map(used.map((object) => [object.id, { x: (object.coordinates!.x - origin.x) / scale, y: (object.coordinates!.y - origin.y) / scale }]));
  const owner = points.get(objectId); if (!owner) return null;
  const at = (id: string) => points.get(id)!;
  const vector = ([a, b]: Segment) => delta(at(b), at(a));
  const length = (segment: Segment) => norm(vector(segment));
  const unit = (segment: Segment) => { const v = vector(segment); const d = norm(v); if (d < 1e-8) throw new Error('Degenerate segment'); return { x: v.x / d, y: v.y / d }; };
  let evaluate: () => number[];
  try {
    if (predicate.kind === 'vector-product-equation') evaluate = () => {
      const fixedOrigin = { x: -origin.x / scale, y: -origin.y / scale };
      const result = evaluateProductEquation(predicate.equation, points, fixedOrigin);
      if (!result) throw new Error('Undefined vector product');
      return [result.value / Math.max(1, result.magnitude)];
    };
    else if (predicate.kind === 'midpoint') evaluate = () => {
      const p = at(predicate.point); const [a, b] = predicate.segment.map(at);
      return [p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2];
    };
    else if (predicate.kind === 'coincident') evaluate = () => { const v = vector(predicate.points); return [v.x, v.y]; };
    else if (predicate.kind === 'collinear') {
      const background = predicate.points.filter((id) => id !== objectId);
      let pair: Segment | null = null; let largest = 0;
      for (let i = 0; i < background.length; i += 1) for (let j = i + 1; j < background.length; j += 1) {
        const candidate: Segment = [background[i], background[j]]; const d = length(candidate);
        if (d > largest) { largest = d; pair = candidate; }
      }
      if (!pair || largest < 1e-8) return null;
      const anchor = pair;
      evaluate = () => predicate.points.filter((id) => !anchor.includes(id)).map((id) => cross(unit(anchor), delta(at(id), at(anchor[0]))));
    } else if (predicate.kind === 'concyclic') {
      const background = predicate.points.filter((id) => id !== objectId);
      let triple: string[] | null = null; let largest = 0;
      for (let i = 0; i < background.length; i += 1) for (let j = i + 1; j < background.length; j += 1) for (let k = j + 1; k < background.length; k += 1) {
        const [a, b, c] = [background[i], background[j], background[k]].map(at);
        const area = Math.abs(cross(delta(b, a), delta(c, a)));
        if (area > largest) { largest = area; triple = [background[i], background[j], background[k]]; }
      }
      if (!triple || largest < 1e-8) return null;
      const [a, b, c] = triple.map(at); const u = delta(b, a); const v = delta(c, a);
      const determinant = 2 * cross(u, v); const uu = u.x ** 2 + u.y ** 2; const vv = v.x ** 2 + v.y ** 2;
      const center = { x: a.x + (uu * v.y - vv * u.y) / determinant, y: a.y + (vv * u.x - uu * v.x) / determinant };
      const radius = norm(delta(a, center));
      evaluate = () => predicate.points.map((id) => (norm(delta(at(id), center)) - radius));
    } else if ('segments' in predicate) evaluate = () => {
      if (predicate.kind === 'equal-length') return [Math.log(length(predicate.segments[0]) / length(predicate.segments[1]))];
      const a = unit(predicate.segments[0]); const b = unit(predicate.segments[1]);
      return [predicate.kind === 'parallel' ? cross(a, b) : a.x * b.x + a.y * b.y];
    };
    else if (predicate.kind === 'directed-angle-equation') {
      const values = () => predicate.terms.map(({ angle: [a, v, b] }) => {
        const value = directedAngleValue(at(a), at(v), at(b)); if (value === null) throw new Error('Undefined directed angle'); return value;
      });
      const initial = values();
      const baseline = wrap(predicate.terms.reduce((sum, term, i) => sum + term.coefficient * initial[i], -predicate.pi.numerator / predicate.pi.denominator));
      // Lift only the local increments. Differentiating a principal-value cut is invalid.
      evaluate = () => { const current = values(); return [predicate.terms.reduce((sum, term, i) => sum + term.coefficient * wrap(current[i] - initial[i]), baseline)]; };
    }
    else if (predicate.kind === 'ordinary-angle-equation') evaluate = () => [predicate.terms.reduce((sum, term) => {
      const [a, v, b] = term.angle; const u = unit([v, a]); const w = unit([v, b]);
      return sum + term.coefficient * Math.atan2(Math.abs(cross(u, w)), u.x * w.x + u.y * w.y) / Math.PI;
    }, -predicate.pi.numerator / predicate.pi.denominator)];
    else if ('constant' in predicate) {
      if (predicate.kind === 'length-sum') evaluate = () => [predicate.terms.reduce((sum, term) => sum + term.coefficient * length(term.segment), 0)];
      else if (predicate.kind === 'length-product') evaluate = () => [predicate.terms.reduce((sum, term) => sum + term.coefficient * Math.log(length(term.segment)), -Math.log(predicate.constant.numerator / predicate.constant.denominator))];
      else {
        const directions = predicate.terms.map((term) => { const v = unit(term.segment); return Math.atan2(v.y, v.x) / Math.PI; });
        const baseline = predicate.terms.reduce((sum, term, i) => sum + term.coefficient * directions[i], -predicate.constant.numerator / predicate.constant.denominator);
        evaluate = () => [predicate.terms.reduce((sum, term, i) => { const v = unit(term.segment); return sum + term.coefficient * wrap(Math.atan2(v.y, v.x) / Math.PI - directions[i]); }, wrap(baseline))];
      }
    } else return null;
    const value = evaluate();
    if (!value.length || value.some((entry) => !Number.isFinite(entry))) return null;
    const residual = Math.max(...value.map(Math.abs));
    if (!differentiate) return { gradients: [], residual };
    if (residual > SAMPLE_EPSILON) return null;
    const h = 1e-5; const [x, y] = [owner.x, owner.y];
    const samples: number[][] = [];
    for (const [dx, dy] of [[h, 0], [-h, 0], [0, h], [0, -h]]) { owner.x = x + dx; owner.y = y + dy; samples.push(evaluate()); }
    owner.x = x; owner.y = y;
    const gradients = value.map((_, i): Gradient => [(samples[0][i] - samples[1][i]) / (2 * h), (samples[2][i] - samples[3][i]) / (2 * h)])
      .filter((row) => row.every(Number.isFinite) && Math.hypot(...row) > 1e-6).map((row): Gradient => {
        const magnitude = Math.hypot(...row); return [row[0] / magnitude, row[1] / magnitude];
      });
    return { gradients, residual: Math.max(...value.map(Math.abs)) };
  } catch { return null; }
};

export const constraintRank = (gradients: readonly Gradient[]): { rank: number; conditioning: number | null } => {
  if (!gradients.length) return { rank: 0, conditioning: null };
  let xx = 0; let xy = 0; let yy = 0;
  for (const [x, y] of gradients) { xx += x * x; xy += x * y; yy += y * y; }
  const trace = xx + yy; const separation = Math.hypot(xx - yy, 2 * xy);
  const high = (trace + separation) / 2; const low = Math.max(0, (trace - separation) / 2);
  return { rank: low / high > 1e-5 ? 2 : 1, conditioning: low / high > 1e-5 ? Math.sqrt(high / low) : null };
};
