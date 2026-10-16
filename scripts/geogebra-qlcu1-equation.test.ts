import { describe, expect, it } from 'vitest';
import { createQLCu1Equation } from './geogebra-qlcu1-equation';

const multiply = ([a, b]: number[], [c, d]: number[]) => [a * c - b * d, a * d + b * c];
const subtract = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);

describe('experimental direct QLCu1 equation', () => {
  it('agrees with the conjugate-midpoint definition under translation, rotation and dragging', () => {
    const { polynomial, expression } = createQLCu1Equation();
    expect(expression).not.toMatch(/\b(?:Zip|Element|ToPoint|ToComplex|Line)\(/u);
    const base = [[0, 0], [4, 0], [3, 3], [-1, 2]];
    for (const [angle, scale, dx, dy] of [[0, 1, 0, 0], [0.7, 2.1, 7, -4], [-1.1, 0.3, -2, 5]]) {
      const points = base.map(([x, y]) => [dx + scale * (x * Math.cos(angle) - y * Math.sin(angle)), dy + scale * (x * Math.sin(angle) + y * Math.cos(angle))]);
      const [a, b, c, d] = points;
      const divisor = subtract(b.map((v, i) => v + d[i]), c.map((v, i) => v + a[i]));
      const norm = divisor.reduce((s, v) => s + v * v, 0);
      const delta = multiply(multiply(subtract(b, a), subtract(d, a)), [divisor[0] / norm, -divisor[1] / norm]);
      const m = a.map((v, i) => v + delta[i]);
      const kappa = multiply(subtract(a, m), subtract(c, m));
      const diagonal1 = a.map((v, i) => (v + c[i]) / 2);
      const diagonal2 = b.map((v, i) => (v + d[i]) / 2);
      const normal = [diagonal1[1] - diagonal2[1], diagonal2[0] - diagonal1[0]];
      const constant = diagonal1[0] * diagonal2[1] - diagonal1[1] * diagonal2[0];
      const numeric = polynomial.replace(/([xy])\(([ABCD])\)/gu, (_, axis: string, p: string) => `(${points['ABCD'.indexOf(p)][axis === 'x' ? 0 : 1]})`).replace(/\^/gu, '**');
      const evaluate = Function('x', 'y', `return ${numeric}`) as (x: number, y: number) => number;
      for (const point of [[0.7, 1.1], [1, 2], [-1.3, 0.8], [3.2, -2.1]]) {
        const w = subtract(point, m); const rho = w.reduce((s, v) => s + v * v, 0);
        const image = multiply(kappa, [w[0] / rho, -w[1] / rho]).map((v, i) => v + m[i]);
        const midpoint = point.map((v, i) => (v + image[i]) / 2);
        // Direct equation uses twice the midpoint-line coefficients, then clears 2*rho.
        const expected = 4 * rho * (normal[0] * midpoint[0] + normal[1] * midpoint[1] + constant);
        expect(Math.abs(evaluate(...point as [number, number]) - expected) / Math.max(1, Math.abs(expected))).toBeLessThan(1e-10);
      }
    }
  });
});
