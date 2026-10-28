import { describe, expect, it } from 'vitest';
import { apolarEquation, conicoPivotalEquation, nonpivotalEquation, pivotalEquation, qaInverseEquation, qaInverseCoefficients } from '../builders/isocubics';

const evaluate = (source: string, [x, y, z]: number[]) => Number(Function('x', 'y', 'z', `return ${source.replace(/\^/gu, '**')}`)(x, y, z));
const numbers = (values: number[]) => values.map(String);
const determinant = (a: number[], b: number[], c: number[]) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
const conjugate = ([x, y, z]: number[], [p, q, r]: number[]) => [p * y * z, q * z * x, r * x * y];

describe('second-stage cubic equations', () => {
  const xyz = ['x', 'y', 'z'];
  const pole = [7, 11, 13];
  const root = [17, 19, 23];
  const x = [2, 3, 5];

  it('makes the pivotal member the collinearity determinant and isotomic specialization', () => {
    const equation = pivotalEquation(xyz, numbers(pole), numbers(root));
    expect(evaluate(equation, x)).toBeCloseTo(determinant(root, x, conjugate(x, pole)), 7);
    const isotomic = pivotalEquation(xyz, ['1', '1', '1'], numbers(root));
    expect(evaluate(isotomic, x)).toBeCloseTo(determinant(root, x, conjugate(x, [1, 1, 1])), 7);
  });

  it('puts Q and its isoconjugate on the six-argument nonpivotal member', () => {
    const q = [3, 4, 5];
    const equation = nonpivotalEquation(xyz, numbers(pole), numbers(root), numbers(q));
    expect(evaluate(equation, q)).toBeCloseTo(0, 7);
    expect(evaluate(equation, conjugate(q, pole))).toBeCloseTo(0, 7);
    expect(evaluate(equation, conjugate(x, pole))).toBeCloseTo(pole[0] * pole[1] * pole[2] * x[0] * x[1] * x[2] * evaluate(equation, x), 3);
    for (const vertex of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) expect(evaluate(equation, vertex)).toBeCloseTo(0, 7);
  });

  it('keeps the zero-parameter member invariant under isoconjugation', () => {
    const equation = apolarEquation(xyz, numbers(pole), numbers(root));
    expect(evaluate(equation, conjugate(x, pole))).toBeCloseTo(pole[0] * pole[1] * pole[2] * x[0] * x[1] * x[2] * evaluate(equation, x), 4);
  });

  it('gives the designated conico-pivotal point a singularity', () => {
    const n = [2, 3, 5];
    const equation = conicoPivotalEquation(xyz, numbers(n), numbers(root));
    expect(evaluate(equation, n)).toBeCloseTo(0, 8);
    const step = 1e-4;
    for (let axis = 0; axis < 3; axis++) {
      const plus = [...n]; const minus = [...n];
      plus[axis] += step; minus[axis] -= step;
      expect((evaluate(equation, plus) - evaluate(equation, minus)) / (2 * step)).toBeCloseTo(0, 5);
    }
  });

  it('evaluates the existing QA-Cu1 equation at P with its fourth vertex variable', () => {
    const sides = [5, 13, 10];
    const p = [3, 4, 6];
    const d = [2, 7, 11];
    const t = d.map((v, i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      return sides[i] * (v + d[j]) * (v + d[k]) - sides[j] * v * (v + d[j]) - sides[k] * v * (v + d[k]);
    });
    const expected = [0, 1, 2].reduce((value, i) => {
      const j = (i + 1) % 3; const k = (i + 2) % 3;
      return value + sides[i] * t[i] * (d[k] * p[j] ** 2 * p[k] - d[j] * p[j] * p[k] ** 2);
    }, 0);
    const equation = qaInverseEquation(numbers(sides), xyz, numbers(p));
    expect(evaluate(equation, d)).toBeCloseTo(expected, 5);
    expect(evaluate(equation, d.map((v) => 2 * v))).toBeCloseTo(8 * expected, 4);
    const coefficients = qaInverseCoefficients(numbers(sides), numbers(p)).map((c) => evaluate(c, [0, 0, 0]));
    const affine = [d[0] / d[2], d[1] / d[2], 1];
    const monomials = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3]];
    const reconstructed = coefficients.reduce((sum, c, i) => sum + c * affine[0] ** monomials[i][0] * affine[1] ** monomials[i][1], 0);
    expect(reconstructed).toBeCloseTo(evaluate(equation, affine), 6);
  });
});
