import { expect, it } from 'vitest';
import type { BindingAllocator } from '../../algebra/homogeneous';
import { createBindingCapture } from '../../bindingPlan';
import { compileStudioCommand } from '../../commandCompiler';
import { expandTool, studioTools } from '../../toolLibrary';

type Point = [number, number];
type Line = [number, number, number];
type Circle = { center: Point; radius: number };
const distance = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const circle = (a: Point, b: Point, c: Point): Circle => {
  const [u, v] = [b[0] - a[0], b[1] - a[1]];
  const [w, t] = [c[0] - a[0], c[1] - a[1]];
  const d = 2 * (u * t - v * w);
  const center: Point = [
    a[0] + ((u * u + v * v) * t - (w * w + t * t) * v) / d,
    a[1] + ((w * w + t * t) * u - (u * u + v * v) * w) / d,
  ];
  return { center, radius: distance(a, center) };
};

function coefficients(name: string, type: 'point' | 'circle', inputs: (Point | Circle | Line)[]) {
  const capture = createBindingCapture();
  let serial = 0;
  const allocate: BindingAllocator = () => `v${++serial}`;
  allocate.captureBinding = capture.captureBinding;
  const labels = ['A', 'B', 'C', 'P'].slice(0, inputs.length);
  const tool = studioTools.get(name.toLowerCase())!;
  const built = expandTool(tool.overloads[0], labels.map((expression, i) => ({
    expression, type: Array.isArray(inputs[i]) && inputs[i].length === 3 ? 'line' : type,
  })), allocate);
  return (built.outputExpressions ?? [built.expression]).map((output) => {
    const plan = capture.lower(output, '0123456789abcdef', true, new Set(['number', 'point', 'circle']));
    const scope: Record<string, unknown> = {
      ...Object.fromEntries(labels.map((label, i) => [label, inputs[i]])),
      x: (point: Point) => point[0], y: (point: Point) => point[1],
      Distance: distance, Circle: circle, Center: (c: Circle) => c.center, Radius: (c: Circle) => c.radius,
      Conic: (data: number[]) => data,
      // Return the conic's barycentric coefficients, before the native matrix transform.
      ApplyMatrix: (_matrix: number[][], data: number[]) => data,
      AreCollinear: () => false,
      If: (condition: boolean, data: number[]) => condition ? data : [],
    };
    const evaluate = (source: string) => Function(...Object.keys(scope),
      `return ${source.replace(/\^/gu, '**').replace(/\{/gu, '[').replace(/\}/gu, ']')}`)(...Object.values(scope));
    for (const { name: label, expression } of plan.helpers) scope[label] = evaluate(expression);
    return evaluate(plan.output) as number[];
  });
}

const asCircle = ([a, , c, , d, e]: number[]): Circle => {
  const center: Point = [-d / (2 * a), -e / (2 * a)];
  return { center, radius: Math.sqrt(center[0] ** 2 + center[1] ** 2 - c / a) };
};

it('constructs the radical circle from equal powers and retains a line at a collinear limit', () => {
  const circles: Circle[] = [
    { center: [2, 1], radius: 1 },
    { center: [6, 1], radius: 2 },
    { center: [3, 5], radius: 0.5 },
  ];
  const radical = asCircle(coefficients('RadicalCircle', 'circle', circles)[0]);
  for (const original of circles) {
    expect(distance(original.center, radical.center) ** 2).toBeCloseTo(original.radius ** 2 + radical.radius ** 2, 10);
  }
  const [a, b, , m, d, e] = coefficients('RadicalCircle', 'circle', [
    circles[0], circles[1], { center: [10, 1], radius: 2 },
  ])[0];
  expect([a, b, m, d].every((value) => value === 0)).toBe(true);
  expect(e).not.toBe(0);
});

it('returns the ellipse director circle and the parabola directrix from the same orthoptic formula', () => {
  const source = compileStudioCommand('OrthopticCircle(Q)', {
    objects: new Map([['Q', 'conic']]), macros: new Set(),
  }).replace(/\^/gu, '**').replace(/\{/gu, '[').replace(/\}/gu, ']');
  const evaluate = Function('Q', 'Conic', 'Coefficients', 'Element', `return ${source}`);
  const fromConic = (data: number[]) => evaluate(data, (x: number[]) => x, (x: number[]) => x,
    (x: number[], i: number) => x[i - 1]) as number[];
  expect(asCircle(fromConic([1 / 9, 1 / 4, -1, 0, 0, 0])).radius).toBeCloseTo(Math.sqrt(13), 10);
  const [a, b, c, m, d, e] = fromConic([0, 1, 0, 0, -8, 0]);
  expect([a, b, m, e].every((value) => value === 0)).toBe(true);
  expect(-c / d).toBe(-2);
});

it('makes the excosine circles orthogonal to the circumcircle, including the diameter limit', () => {
  const points: Point[] = [[1, 3], [0, 0], [4, 0]];
  const circumcircle = circle(points[0], points[1], points[2]);
  const excosine = asCircle(coefficients('ExcosineCircles', 'point', points)[0]);
  expect(distance(excosine.center, points[1])).toBeCloseTo(excosine.radius, 10);
  expect(distance(excosine.center, points[2])).toBeCloseTo(excosine.radius, 10);
  expect(distance(excosine.center, circumcircle.center) ** 2).toBeCloseTo(excosine.radius ** 2 + circumcircle.radius ** 2, 10);
  const [a, b, c, m, d, e] = coefficients('ExcosineCircles', 'point', [[2, 2], [0, 0], [4, 0]])[0];
  expect([a, b, c, m, d].every((value) => value === 0)).toBe(true);
  expect(e).not.toBe(0);
});

it('contains the cevian traces and keeps their finite join when one trace is ideal', () => {
  const vertices: Point[] = [[1, 1], [5, 1], [1, 4]];
  const evaluate = ([a, b, c, m, d, e]: number[], [x, y]: Point) =>
    (a * x * x + b * y * y + c + m * x * y + d * x + e * y) / Math.hypot(a, b, c, m, d, e);
  const [ideal] = coefficients('CevianCircle', 'point', [...vertices, [3, -4, 29]]);
  for (const trace of [[3, 2.5], [1, -2], [-3, 1]] as Point[]) {
    expect(evaluate(ideal, trace)).toBeCloseTo(0, 10);
  }
  const [parallel] = coefficients('CevianCircle', 'point', [...vertices, [3, 4, 7]]);
  expect(Math.abs(parallel[0])).toBe(0);
  expect(Math.hypot(parallel[4], parallel[5])).toBeGreaterThan(0);
  for (const trace of vertices.slice(1)) expect(evaluate(parallel, trace)).toBeCloseTo(0, 10);
  const [ordinary] = coefficients('CevianCircle', 'point', [...vertices, [2, 2]]);
  for (const trace of [[19 / 7, 19 / 7], [1, 7 / 3], [2.5, 1]] as Point[]) {
    expect(evaluate(ordinary, trace)).toBeCloseTo(0, 10);
  }
  const [limit] = coefficients('CevianCircle', 'point', [...vertices, [-1, 2.5]]);
  expect(limit[0]).toBeCloseTo(0, 10);
  for (const trace of [[1, 2], [-3, 1]] as Point[]) expect(evaluate(limit, trace)).toBeCloseTo(0, 10);
});

it('gives an inscribed parabola in an ideal direction and a double line in a sideline direction', () => {
  const vertices: Point[] = [[0, 0], [4, 0], [0, 3]];
  const [a, b, c, h, d, e] = coefficients('InconicWithCenter', 'point', [...vertices, [3, -4, 19]])[0];
  // The three coordinate sidelines each cut a repeated root.
  expect(h * h - 4 * a * b).toBe(0);
  expect(d * d - 4 * a * c).toBe(0);
  expect(e * e - 4 * b * c).toBe(0);
  // Substitute barycentrics (1-v-w,v,w) in the quadratic part.
  const vv = a + b - h;
  const ww = a + c - d;
  const vw = 2 * a - h - d + e;
  expect(vv * ww).toBeGreaterThan(0);
  expect(vw * vw - 4 * vv * ww).toBe(0);
  const parallel = coefficients('InconicWithCenter', 'point', [...vertices, [3, 4, 0]])[0];
  expect(parallel.map((value) => value / parallel[1] || 0)).toEqual([0, 1, 1, 0, 0, 2]);
});
