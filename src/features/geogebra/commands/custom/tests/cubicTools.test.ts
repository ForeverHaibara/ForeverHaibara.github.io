import { describe, expect, it } from 'vitest';
import { cayleyBacharachMinors, circularCubicMinors, cubicHessian } from '../builders/cubicConstructions';

const determinant = (input: number[][]) => {
  const rows = input.map((row) => [...row]);
  let product = 1;
  for (let k = 0; k < rows.length; k++) {
    let pivot = k;
    for (let i = k + 1; i < rows.length; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[pivot][k])) pivot = i;
    if (Math.abs(rows[pivot][k]) < 1e-12) return 0;
    if (pivot !== k) { [rows[k], rows[pivot]] = [rows[pivot], rows[k]]; product = -product; }
    const diagonal = rows[k][k]; product *= diagonal;
    for (let i = k + 1; i < rows.length; i++) {
      const factor = rows[i][k] / diagonal;
      for (let j = k + 1; j < rows.length; j++) rows[i][j] -= factor * rows[k][j];
    }
  }
  return product;
};

const evaluate = (expression: string, points: Record<string, number[]>) => {
  const labels = Object.keys(points);
  const source = expression.replace(/\{/gu, '[').replace(/\}/gu, ']').replace(/\^/gu, '**');
  return Number(Function('x', 'y', 'Determinant', ...labels, `return ${source}`)(
    (p: number[]) => p[0], (p: number[]) => p[1], determinant, ...labels.map((label) => points[label])));
};
const labels = 'ABCDEFGH'.split('');

describe('new cubic families and base-point formulas', () => {
  it('forms the homogeneous Hessian, including lower affine degree terms', () => {
    // F=X^3+Y^3+Z^3 has Hessian diag(6X,6Y,6Z).
    const h = cubicHessian(['1', '0', '0', '0', '0', '0', '1', '0', '0', '1']);
    const expected = [['6', '0', '0'], ['0', '6', '0'], ['0', '0', '6']];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
      const actual = Number(Function(`return ${h[i][j][k]}`)());
      expect(actual).toBe(i === j ? expected[i][k] === '6' ? 6 : 0 : 0);
    }
  });

  it('finds the unique circular cubic through seven independent points', () => {
    const points = [[2, -2], [2, -1], [2, 0], [2, 1], [3, 4], [-3, 4], [0, -5]];
    const scope = Object.fromEntries(labels.slice(0, 7).map((label, i) => [label, points[i]]));
    const { cs } = circularCubicMinors(labels.slice(0, 7));
    const coefficients = cs.map((c) => evaluate(c, scope));
    expect(Math.hypot(...coefficients)).toBeGreaterThan(0);
    for (const [x, y] of points) {
      const rho = x * x + y * y;
      const basis = [x * rho, y * rho, x * x, x * y, y * y, x, y, 1];
      const residual = coefficients.reduce((sum, c, i) => sum + c * basis[i], 0);
      expect(residual / Math.hypot(...coefficients)).toBeCloseTo(0, 7);
    }
  });

  it('finds the missing ninth point of a transverse 3-by-3 cubic intersection', () => {
    const points = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2]];
    const scope = Object.fromEntries(labels.map((label, i) => [label, points[i]]));
    const order = ['A', 'B', 'D', 'C', 'E', 'F', 'G', 'H']; // first three must be noncollinear
    const [cx, cy, cz, dx, dy, dz] = cayleyBacharachMinors(order).map((s) => evaluate(s, scope));
    const weights = [cx * dy * dz, dx * cy * dz, dx * dy * cz];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(Math.abs(total)).toBeGreaterThan(0);
    const result = [0, 1].map((axis) => weights.reduce((s, w, i) => s + w * scope[order[i]][axis], 0) / total);
    expect(result[0]).toBeCloseTo(2, 6);
    expect(result[1]).toBeCloseTo(2, 6);
  });

  it('finds the seventh finite base point of a circular-cubic pencil', () => {
    // (x^2+y^2-25)x and (x^2+y^2-8x-9)y intersect at these six points and (0,0).
    const r = Math.sqrt(21);
    const points = [[2, r], [2, -r], [0, 3], [0, -3], [5, 0], [-5, 0]];
    const scope = Object.fromEntries(labels.slice(0, 6).map((label, i) => [label, points[i]]));
    const [cx, cy, cz, dx, dy, dz] = cayleyBacharachMinors(labels.slice(0, 6)).map((s) => evaluate(s, scope));
    const weights = [cx * dy * dz, dx * cy * dz, dx * dy * cz];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(Math.abs(total)).toBeGreaterThan(0);
    const result = [0, 1].map((axis) => weights.reduce((s, w, i) => s + w * points[i][axis], 0) / total);
    expect(result[0]).toBeCloseTo(0, 6);
    expect(result[1]).toBeCloseTo(0, 6);
  });
});
