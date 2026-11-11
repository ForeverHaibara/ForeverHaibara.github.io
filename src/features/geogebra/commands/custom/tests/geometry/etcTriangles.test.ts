import { expect, it } from 'vitest';
import { createBindingCapture } from '../../bindingPlan';
import { expandTool, studioTools } from '../../toolLibrary';
import type { BindingAllocator } from '../../algebra/homogeneous';

type Point = [number, number];
const sub = ([x, y]: Point, [u, v]: Point): Point => [x - u, y - v];
const det = ([x, y]: Point, [u, v]: Point) => x * v - y * u;
const rotate = ([x, y]: Point, angle: number): Point =>
  [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];

const morleyVertices = (name: string, vertices: Point[], kind: number) => {
  const capture = createBindingCapture();
  let serial = 0;
  const allocate: BindingAllocator = () => `v${++serial}`;
  allocate.captureBinding = capture.captureBinding;
  const tool = studioTools.get(name.toLowerCase())!;
  const overload = tool.overloads.find((candidate) => candidate.params.length === 4)!;
  const result = expandTool(overload, [
    ...['A', 'B', 'C'].map((expression) => ({ expression, type: 'point' as const })),
    { expression: String(kind), type: 'number' },
  ], allocate);
  return result.outputExpressions!.map((expression) => {
    const plan = capture.lower(expression, '0123456789abcdef', true);
    const [A, B, C] = vertices;
    const scope: Record<string, unknown> = {
      A, B, C, π: Math.PI, acos: Math.acos, cos: Math.cos, Max: Math.max, Min: Math.min,
      If: (condition: boolean, value: number, fallback?: number) => condition ? value : fallback,
      Distance: (p: Point, q: Point) => Math.hypot(...sub(p, q)),
      AreCollinear: () => false,
    };
    const evaluate = (source: string, values = scope) =>
      Function(...Object.keys(values), `return ${source.replace(/\^/gu, '**')}`)(...Object.values(values));
    for (const { name: key, expression: source } of plan.helpers) scope[key] = evaluate(source);
    return [0, 1].map((axis) => evaluate(plan.output, { ...scope, A: A[axis], B: B[axis], C: C[axis] }));
  });
};

it('matches all numbered Morley and adjunct variants to rotated trisectors under either orientation', () => {
  const ccw: Point[] = [[0, 0], [5, 0], [1, 3]];
  for (const vertices of [ccw, [ccw[0], ccw[2], ccw[1]]]) {
    for (const adjunct of [false, true]) {
      for (const [kind, shift] of [[1, 0], [2, Math.PI / 3], [3, -Math.PI / 3]]) {
        const actual = morleyVertices(adjunct ? 'MorleyAdjunctTriangle' : 'MorleyTriangle', vertices, kind);
        for (let i = 0; i < 3; i++) {
          const [a, b, c] = [vertices[i], vertices[(i + 1) % 3], vertices[(i + 2) % 3]];
          const angle = (u: Point, v: Point) =>
            Math.atan2(Math.abs(det(u, v)), u[0] * v[0] + u[1] * v[1]);
          const orientation = Math.sign(det(sub(b, a), sub(c, a)));
          const turn = adjunct ? -shift : shift;
          const fraction = adjunct ? 2 / 3 : 1 / 3;
          const bc = sub(c, b);
          const cb = sub(b, c);
          const u = rotate(bc, orientation * (fraction * angle(bc, sub(a, b)) + turn));
          const v = rotate(cb, -orientation * (fraction * angle(cb, sub(a, c)) + turn));
          const distance = det(bc, v) / det(u, v);
          expect(actual[i][0]).toBeCloseTo(b[0] + distance * u[0], 9);
          expect(actual[i][1]).toBeCloseTo(b[1] + distance * u[1], 9);
        }
      }
    }
  }
});
