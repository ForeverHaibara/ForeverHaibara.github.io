import { expect, it } from 'vitest';
import type { BindingAllocator } from '../../algebra/homogeneous';
import { createBindingCapture } from '../../bindingPlan';
import { apolloniusProblem } from '../../builders/apollonius';

type Pair = [number, number];
type Circle = { center: Pair; radius: number };
type Constraint =
  | { type: 'point'; data: Pair }
  | { type: 'line'; data: [number, number, number] }
  | { type: 'circle'; data: Circle };

function solve(inputs: Constraint[]) {
  const capture = createBindingCapture();
  let serial = 0;
  const allocate: BindingAllocator = () => `v${++serial}`;
  allocate.captureBinding = capture.captureBinding;
  const labels = ['A', 'B', 'C'];
  const built = apolloniusProblem(inputs.map(({ type }, i) => ({ type, expression: labels[i] })), allocate);
  if (typeof built === 'string') throw new Error('Expected separate solution slots');
  return built.outputExpressions!.flatMap((output) => {
    const plan = capture.lower(output, '0123456789abcdef', true);
    const scope: Record<string, unknown> = {
      ...Object.fromEntries(labels.map((label, i) => [label, inputs[i].data])),
      x: (v: number[]) => v[0], y: (v: number[]) => v[1], z: (v: number[]) => v[2],
      Center: (c: Circle) => c.center, Radius: (c: Circle) => c.radius,
      abs: Math.abs, sqrt: Math.sqrt, If: (condition: boolean, yes: unknown, no?: unknown) => condition ? yes : no,
      Circle: (x: number, y: number, radius: number): Circle => ({ center: [x, y], radius }),
    };
    const evaluate = (source: string) => Function(...Object.keys(scope), `return ${source.replace(/\^/gu, '**')
      .replace(/Circle\(\(/gu, 'Circle(').replace(/\),abs\(/gu, ',abs(')}`)(...Object.values(scope));
    for (const { name, expression } of plan.helpers) scope[name] = evaluate(expression);
    const result = evaluate(plan.output) as Circle | undefined;
    return result ? [result] : [];
  });
}

const distance = ([x, y]: Pair, [u, v]: Pair) => Math.hypot(x - u, y - v);
const point = (x: number, y: number): Constraint => ({ type: 'point', data: [x, y] });
const line = (a: number, b: number, c: number): Constraint => ({ type: 'line', data: [a, b, c] });
const circle = (x: number, y: number, radius: number): Constraint => ({ type: 'circle', data: { center: [x, y], radius } });

const points = [point(2, 0), point(0, 2)];
const lines = [line(3, 0, -6), line(0, -5, 10), line(1, 1, 2 * Math.SQRT2)];
const circles = [circle(3, 0, 1), circle(0, 3, 1), circle(-3, 0, 1)];

it.each([
  [points[0], points[1], lines[2]], [points[0], points[1], circles[2]],
  [points[0], lines[1], lines[2]], [points[0], lines[2], circles[1]], [points[0], circles[1], circles[2]],
  lines, [lines[0], lines[1], circles[2]], [lines[2], circles[0], circles[1]], circles,
].map((inputs) => ({ inputs, signature: inputs.map(({ type }) => type).join(', ') })))(
  'satisfies all $signature constraints and finds the known solution in either order', ({ inputs }) => {
    for (const ordered of [inputs, [...inputs].reverse()]) {
      const solutions = solve(ordered);
      expect(solutions.some(({ center, radius }) => distance(center, [0, 0]) + Math.abs(radius - 2) < 1e-8)).toBe(true);
      for (const { center, radius } of solutions) for (const constraint of inputs) {
        if (constraint.type === 'point') {
          expect(distance(center, constraint.data)).toBeCloseTo(radius, 8);
        } else if (constraint.type === 'line') {
          const [a, b, c] = constraint.data;
          expect(Math.abs(a * center[0] + b * center[1] + c) / Math.hypot(a, b)).toBeCloseTo(radius, 8);
        } else {
          const d = distance(center, constraint.data.center);
          expect(Math.min(Math.abs(d - radius - constraint.data.radius),
            Math.abs(d - Math.abs(radius - constraint.data.radius)))).toBeLessThan(1e-8);
        }
      }
    }
  });

it('returns eight circles for three separated equal circles and four for a triangle of lines', () => {
  expect(solve(circles)).toHaveLength(8);
  expect(solve(lines)).toHaveLength(4);
});

it('rejects impossible constraints and preserves the linear-radius and repeated-root cases', () => {
  expect(solve([point(0, 1), point(0, -1), line(0, 1, 0)])).toHaveLength(0);
  expect(solve([point(0, 0), point(2, 0), line(0, 1, -1)])).toHaveLength(1);
  expect(solve([point(0, 0), point(0, 2), line(0, 1, 0)])).toHaveLength(1);
});

it('finds isolated solutions for collinear circle centers and two parallel lines', () => {
  const solutions = solve([circle(-Math.sqrt(5), 0, 1), circle(Math.sqrt(5), 0, 1), circle(0, 0, 4)]);
  expect(solutions.some(({ center, radius }) => distance(center, [0, 2]) + Math.abs(radius - 2) < 1e-8)).toBe(true);
  expect(solve([line(0, 1, -1), line(0, 1, 1), line(1, 0, 0)])).toHaveLength(2);
  expect(solve([point(1, 0), point(1, 0), line(1, 0, 0)])).toHaveLength(0);
});
