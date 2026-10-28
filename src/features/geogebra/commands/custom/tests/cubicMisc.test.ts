import { describe, expect, it } from 'vitest';
import { kernelMinors, CUBIC_MISC_BUILDERS } from '../builders/cubicMisc';
import { compileStudioCommand } from '../commandCompiler';
import type { CommandEnvironment, GeometryType, TypedExpression } from '../types';

const determinant = (rows: number[][]) => {
  const a = rows.map((row) => [...row]);
  let answer = 1;
  for (let k = 0; k < a.length; k++) {
    let pivot = k;
    for (let i = k + 1; i < a.length; i++) if (Math.abs(a[i][k]) > Math.abs(a[pivot][k])) pivot = i;
    if (pivot !== k) { [a[pivot], a[k]] = [a[k], a[pivot]]; answer = -answer; }
    const diagonal = a[k][k]; answer *= diagonal;
    for (let i = k + 1; i < a.length; i++) for (let j = k + 1; j < a.length; j++)
      a[i][j] -= a[i][k] * a[k][j] / diagonal;
  }
  return answer;
};
const numeric = (expression: string) => Number(Function('Determinant', `return ${expression.replace(/\{/gu, '[').replace(/\}/gu, ']')}`)(determinant));
const point = (name: string): TypedExpression => ({ expression: name, type: 'point' });
const line = (name: string): TypedExpression => ({ expression: name, type: 'line' });
const polynomial = (source: string, coordinates: Record<string, readonly number[]>, x: number, y: number) => {
  const curve = source.startsWith('If(') ? source.replace(/^.*ImplicitCurve\(/u, '').replace(/\)\)$/u, '') : source.replace(/^ImplicitCurve\(/u, '').replace(/\)$/u, '');
  const expression = curve.replace(/([xyz])\((\w+)\)/gu,
    (_, axis: string, label: string) => String(coordinates[label][{ x: 0, y: 1, z: 2 }[axis as 'x' | 'y' | 'z']])).replace(/\^/gu, '**');
  return Number(Function('x', 'y', `return ${expression}`)(x, y));
};

describe('inserted cubic constructions', () => {
  it('finds the circular nodal cubic through four points without a node inversion', () => {
    const points = [[0.5, 0.5], [0.5, -0.5], [0.8, 1.6], [0.8, -1.6]];
    const rows = points.map(([x, y]) => [x * (x * x + y * y), y * (x * x + y * y), x * x, x * y, y * y]);
    const coefficients = kernelMinors(rows.map((row) => row.map(String))).map(numeric);
    const scale = coefficients[0];
    expect(Math.abs(scale)).toBeGreaterThan(1e-8);
    expect(coefficients.map((c) => c / scale)).toEqual(expect.arrayContaining([expect.closeTo(1, 7), expect.closeTo(0, 7), expect.closeTo(0, 7), expect.closeTo(0, 7), expect.closeTo(-1, 7)]));
    for (const row of rows) expect(row.reduce((v, entry, i) => v + entry * coefficients[i], 0)).toBeCloseTo(0, 8);
  });

  it('uses the signed angle condition for the three-point strophoid', () => {
    const curve = CUBIC_MISC_BUILDERS.strophoid([point('A'), point('B'), point('C')], () => 'v1') as string;
    const scope = { A: [0, 0], B: [2, 0], C: [0, 3] };
    for (const [x, y] of [[0, 0], [2, 0], [0, 3]]) expect(polynomial(curve, scope, x, y)).toBeCloseTo(0, 8);
    const h = 1e-4;
    expect((polynomial(curve, scope, h, 0) - polynomial(curve, scope, -h, 0)) / (2 * h)).toBeCloseTo(0, 5);
    expect((polynomial(curve, scope, 0, h) - polynomial(curve, scope, 0, -h)) / (2 * h)).toBeCloseTo(0, 5);
  });

  it('eliminates the moving circle center even when its line misses the node', () => {
    const curve = CUBIC_MISC_BUILDERS.strophoid([point('A'), point('B'), line('l')], () => 'v1') as string;
    const scope = { A: [0, 0], B: [1, 0], l: [1, 0, -2] };
    for (const s of [1 + Math.sqrt(5 / 2), 1 - Math.sqrt(5 / 2)])
      expect(polynomial(curve, scope, 1 + s, s)).toBeCloseTo(0, 7);
  });

  it('expands the native asymptotes as independent lines and selects one by index', () => {
    const scope: CommandEnvironment = { objects: new Map<string, GeometryType>([['F', 'implicitCurve'], ['A', 'point']]), macros: new Set() };
    expect(compileStudioCommand('CubicAsymptotes(F)', scope).split('\n')).toHaveLength(3);
    expect(compileStudioCommand('CubicAsymptotes(F,2)', scope)).toContain('floor');
    expect(compileStudioCommand('Tangential(F,A)', scope)).toContain('Coefficients');
  });

  it('creates independent pretangentials and three involution points with indexed access', () => {
    const scope: CommandEnvironment = { objects: new Map<string, GeometryType>([['F', 'implicitCurve'], ['A', 'point']]), macros: new Set() };
    const pre = compileStudioCommand('Pretangential(F,A)', scope).split('\n');
    const involution = compileStudioCommand('CubicInvolution(F,A)', scope).split('\n');
    expect(pre).toHaveLength(4);
    expect(involution).toHaveLength(3);
    expect(pre.every((line) => line.includes('Intersect(') && line.includes('Conic('))).toBe(true);
    expect(involution.every((line) => line.includes('KeepIf(') && line.includes('Intersect('))).toBe(true);
    expect(compileStudioCommand('Pretangential(F,A,2)', scope)).toContain('floor(2)');
    expect(compileStudioCommand('CubicInvolution(F,A,2)', scope)).toContain('floor(2)');
  });
});
