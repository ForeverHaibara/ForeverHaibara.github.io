import { expect, it } from 'vitest';
import type { BindingAllocator } from '../../algebra/homogeneous';
import { createBindingCapture } from '../../bindingPlan';
import { expandTool, studioTools } from '../../toolLibrary';

type Point = [number, number];
type Line = [number, number, number];
const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const subtract = (p: Point, q: Point): Point => [p[0] - q[0], p[1] - q[1]];
const det = (p: Point, q: Point) => p[0] * q[1] - p[1] * q[0];
const abc: [Point, Point, Point] = [[0, 0], [5, 0], [1, 3]];

function evaluatePoints(name: string, points: (Point | Line)[]) {
  const capture = createBindingCapture();
  let serial = 0;
  const allocate: BindingAllocator = () => `v${++serial}`;
  allocate.captureBinding = capture.captureBinding;
  const labels = points.map((_, i) => String.fromCharCode(65 + i));
  const tool = studioTools.get(name.toLowerCase())!;
  const args = labels.map((expression, i) => ({ expression, type: points[i].length === 2 ? 'point' as const : 'line' as const }));
  const overload = tool.overloads.find(({ params }) => params.length === args.length
    && params.every(({ type }, i) => type === args[i].type || type === 'pointOrLine' || (type === 'lineLike' && args[i].type === 'line')))!;
  const built = expandTool(overload, args, allocate);
  return (built.outputExpressions ?? [built.expression]).map((output) => {
    const plan = capture.lower(output, '0123456789abcdef', true);
    const scope: Record<string, unknown> = {
      ...Object.fromEntries(labels.map((label, i) => [label, points[i]])),
      x: (point: Point) => point[0], y: (point: Point) => point[1], Distance: distance,
      If: (condition: boolean, value: number) => condition ? value : NaN,
    };
    const evaluate = (source: string, values = scope) =>
      Function(...Object.keys(values), `return ${source.replace(/\^/gu, '**')}`)(...Object.values(values)) as number;
    for (const { name: key, expression } of plan.helpers) scope[key] = evaluate(expression);
    // The output combines points affinely. Evaluate its two coordinates with
    // the already computed scalar bindings and the real triangle guard.
    scope.AreCollinear = () => Math.abs(det(subtract(points[4] as Point, points[3] as Point), subtract(points[5] as Point, points[3] as Point))) < 1e-12;
    const coordinate = (axis: 0 | 1) => evaluate(plan.output, {
      ...scope, ...Object.fromEntries(labels.map((label, i) => [label, points[i][axis]])),
    });
    return [coordinate(0), coordinate(1)] as Point;
  });
}

const apply = (name: string, points: Point[]) => evaluatePoints(name, points)[0];

it.each([
  'ComplementaryConjugate', 'AnticomplementaryConjugate', 'GimelConjugate', 'DalethConjugate',
  'HeConjugate', 'WawConjugate', 'ZayinConjugate', 'HirstInverse', 'GibertPsi',
])('%s reverses itself for a fixed pivot', (name) => {
  const pivot: Point = [1.35, 0.8];
  for (const point of [[2.05, 1.23], [4, 2.5], [-1.1, 1.4]] as Point[]) {
    const image = apply(name, [...abc, pivot, point]);
    expect(distance(apply(name, [...abc, pivot, image]), point)).toBeLessThan(1e-7);
  }
});

it('matches antitomic conjugacy to ellipse inversion, including the continued map on a sideline', () => {
  const point: Point = [1.8, 0.9];
  const centroid: Point = [2, 1];
  const barycentrics = (p: Point) => {
    const c = p[1] / 3;
    const b = (p[0] - c) / 5;
    return [1 - b - c, b, c];
  };
  const isotomic = (p: Point): Point => {
    const [a, b, c] = barycentrics(p).map((v) => 1 / v);
    return [(5 * b + c) / (a + b + c), 3 * c / (a + b + c)];
  };
  const initial = isotomic(point);
  const norm2 = barycentrics(initial).reduce((sum, v) => sum + (v - 1 / 3) ** 2, 0);
  const inverted = centroid.map((v, i) => v + 2 / (3 * norm2) * (initial[i] - v)) as Point;
  expect(distance(apply('AntitomicConjugate', [...abc, point]), isotomic(inverted))).toBeLessThan(1e-9);
  expect(distance(apply('AntitomicConjugate', [...abc, [2, 0]]), [3, 0])).toBeLessThan(1e-9);
});

it('maps a generic point of the nine-point circle to the orthocenter under Syngonal', () => {
  const circumcenter: Point = [2.5, 5 / 6];
  const orthocenter: Point = [1, 4 / 3];
  const radius = distance(abc[0], circumcenter) / 2;
  const point: Point = [(circumcenter[0] + orthocenter[0]) / 2 + radius, (circumcenter[1] + orthocenter[1]) / 2];
  expect(distance(apply('Syngonal', [...abc, point]), orthocenter)).toBeLessThan(1e-9);
});

it('keeps the dual vertices finite and on the circumcircle, including a reference-side direction', () => {
  const vertices = evaluatePoints('DualTriangle', [...abc, [1, 1], [-1, 2], [3, 2]]);
  const center: Point = [2.5, 5 / 6];
  for (const point of vertices) expect(distance(point, center)).toBeCloseTo(distance(abc[0], center), 9);
  expect(distance(vertices[0], abc[2])).toBeLessThan(1e-9);
});

it('uses harmonic cevian traces and returns a collinear cocevian triple', () => {
  const vertices = evaluatePoints('CocevianTriangle', [...abc, [1.7, 0.9]]);
  expect(det(subtract(vertices[1], vertices[0]), subtract(vertices[2], vertices[0]))).toBeCloseTo(0, 9);
  const trace = 0.4;
  const harmonic = vertices[2][0] / 5;
  expect((trace / (trace - 1)) / (harmonic / (harmonic - 1))).toBeCloseTo(-1, 9);
});

it('recovers a triangle after two unary cofactor operations and transports trilinear frames', () => {
  const def: [Point, Point, Point] = [[-1, 2], [1, -1], [7, 1]];
  const cofactor = evaluatePoints('UnaryCofactorTriangle', [...abc, ...def]);
  const recovered = evaluatePoints('UnaryCofactorTriangle', [...abc, ...cofactor]);
  recovered.forEach((p, i) => expect(distance(p, def[i])).toBeLessThan(1e-9));
  const point: Point = [3, 2];
  const image = apply('TrilinearImage', [...abc, ...def, point]);
  expect(distance(apply('TrilinearImage', [...def, ...abc, image]), point)).toBeLessThan(1e-9);
});

it('sends a circumcircle point to the trilinear pole of its Simson line under GST', () => {
  const [a, b, c] = abc;
  const center: Point = [2.5, 5 / 6];
  const point: Point = [center[0] + distance(center, a), center[1]];
  const foot = (start: Point, end: Point): Point => {
    const [x, y] = subtract(end, start);
    const [u, v] = subtract(point, start);
    const t = (x * u + y * v) / (x * x + y * y);
    return [start[0] + t * x, start[1] + t * y];
  };
  const u = foot(a, b);
  const v = foot(b, c);
  const weights = abc.map((vertex) => 1 / det(subtract(v, u), subtract(vertex, u)));
  const expected = [0, 1].map((axis) =>
    abc.reduce((sum, vertex, i) => sum + vertex[axis] * weights[i], 0) / weights.reduce((x, y) => x + y)) as Point;
  expect(distance(apply('GST', [...abc, point]), expected)).toBeLessThan(1e-9);
});

it('agrees with the published centroid images for OT and OC, and reverses OC', () => {
  const frame: Point[] = [[0, 0], [5, 0], [1, 4]];
  const centroid: Point = [2, 4 / 3];
  const x69: Point = [112 / 37, 48 / 37];
  expect(distance(apply('OrionTransform', [...frame, centroid]), x69)).toBeLessThan(1e-9);
  expect(distance(apply('OrionConjugate', [...frame, centroid]), x69)).toBeLessThan(1e-9);
  expect(distance(apply('OrionConjugate', [...frame, x69]), centroid)).toBeLessThan(1e-9);
});

it('matches centroid-based Gibert Psi to inversion followed by reflection in a Steiner-inellipse axis', () => {
  const centroid: Point = [2, 1];
  // The inellipse shape matrix is [[14,-3],[-3,6]]/6. Its squared
  // focal distance is 5/3 and its major-axis reflection is [[.8,-.6],[-.6,-.8]].
  expect(distance(apply('GibertPsi', [...abc, centroid, [3, 2]]), [13 / 6, -1 / 6])).toBeLessThan(1e-9);
});

it('uses ideal directions in cevian traces and preserves the other slots at a parallel sideline', () => {
  const vertices: Point[] = [[0, 0], [4, 0], [0, 3]];
  const expected = [[2, 1.5], [0, -3], [-4, 0]];
  expect(evaluatePoints('CevianTriangle', [...vertices, [3, -4, 0]])).toEqual(expected);
  evaluatePoints('CevianTriangle', [...vertices, [-6, 8, 17]]).forEach((point, i) => {
    expect(distance(point, expected[i] as Point)).toBe(0);
  });
  const parallel = evaluatePoints('CevianTriangle', [...vertices, [3, 4, 7]]);
  expect(parallel[0].every((coordinate) => !Number.isFinite(coordinate))).toBe(true);
  expect(distance(parallel[1], [0, 3])).toBe(0);
  expect(distance(parallel[2], [4, 0])).toBe(0);
  expect(evaluatePoints('CocevianTriangle', [...vertices, [3, 4, 7]])[0]).toEqual([2, 1.5]);
});

it('evaluates both isoconjugation formulas with ideal calibration or pivot weights', () => {
  const vertices: Point[] = [[0, 0], [4, 0], [0, 3]];
  const euler: Line = [3, -4, 0];
  const operand: Point = [4 / 3, 4 / 3];
  const five = evaluatePoints('Isoconjugate', [...vertices, euler, operand])[0];
  expect(distance(five, [36 / (-25 / 4), 48 / (-25 / 4)])).toBeLessThan(1e-9);
  const six = evaluatePoints('Isoconjugate', [...vertices, euler, [6, -8, 23], operand])[0];
  expect(distance(six, [16 / 31, 9 / 31])).toBeLessThan(1e-9);
  const calibration: Point = [1, 1];
  const sentToInfinity = evaluatePoints('Isoconjugate', [...vertices, calibration, euler, calibration])[0];
  expect(sentToInfinity.every((coordinate) => !Number.isFinite(coordinate))).toBe(true);
});
