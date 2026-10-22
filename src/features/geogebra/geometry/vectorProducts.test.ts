import { describe, expect, it } from 'vitest';
import { evaluateProductEquation, formatProductEquation, mapProductPoints, productEquationKey, productPoints, productRow } from './vectorProducts';
import { productPredicate } from '../reasoning/__fixtures__/vectorProducts';
import type { VectorProductEquation } from './vectorProducts';
import katex from 'katex';

const equation = (operation: 'dot' | 'cross'): VectorProductEquation => ({ operation,
  terms: [{ coefficient: 1, left: ['A', 'B'], right: ['A', 'C'] }, { coefficient: -1, left: ['A', 'B'], right: ['A', 'D'] }] });

describe('signed vector expressions and position atoms', () => {
  it('factors common vectors without losing direction signs', () => {
    for (const operation of ['dot', 'cross'] as const) expect(productRow(equation(operation))).toEqual(productRow({ operation,
      terms: [{ coefficient: 1, left: ['A', 'B'], right: ['D', 'C'] }] }));
  });
  it('keeps dot symmetric and cross antisymmetric', () => {
    const term = { coefficient: 1, left: ['A', 'B'] as [string, string], right: ['C', 'D'] as [string, string] };
    for (const operation of ['dot', 'cross'] as const) {
      const first = productRow({ operation, terms: [term] });
      const second = productRow({ operation, terms: [{ ...term, left: term.right, right: term.left }] });
      expect(second).toEqual(Object.fromEntries(Object.entries(first).map(([key, value]) => [key, operation === 'dot' ? value : -value])));
    }
  });
  it('canonicalizes integer scale and whole-equation sign, while removing identities', () => {
    const first = equation('cross');
    expect(productEquationKey(first)).toBe(productEquationKey({ ...first, terms: first.terms.map((term) => ({ ...term, coefficient: -6 * term.coefficient })) }));
    expect(productRow({ operation: 'cross', terms: [{ coefficient: 1, left: ['A', 'B'], right: ['A', 'B'] }] })).toEqual({});
    expect(() => productRow({ operation: 'dot', terms: [{ coefficient: 0.5, left: ['A', 'B'], right: ['C', 'D'] }] })).toThrow();
  });
  it('preserves displacement equations under translation, rotation, reflection and unit changes', () => {
    for (const operation of ['dot', 'cross'] as const) for (const scale of [1e-10, 1, 1e10]) for (const mirror of [-1, 1]) {
      const points = new Map([['A', [0, 0]], ['B', [3, 0]], ['C', [2, 1]], ['D', [2, 4]]].map(([name, raw]) => {
        const [x, y] = raw as number[]; const t = 0.71;
        return [name as string, { x: scale * (4 + x * Math.cos(t) - mirror * y * Math.sin(t)), y: scale * (-3 + x * Math.sin(t) + mirror * y * Math.cos(t)) }];
      }));
      const result = evaluateProductEquation(equation(operation), points)!;
      if (operation === 'dot') expect(result.residual).toBeLessThan(1e-13);
      else expect(result.value / (scale * scale)).toBeCloseTo(-9 * mirror, 8);
    }
  });
  it('supports a nonconstructed origin and remaps only real points', () => {
    const value: VectorProductEquation = { operation: 'dot', terms: [{ coefficient: 1, left: [null, 'A'], right: [null, 'B'] }] };
    expect(productPoints(value)).toEqual(['A', 'B']);
    expect(mapProductPoints(value, (name) => `p:${name}`).terms[0].left).toEqual([null, 'p:A']);
    const points = new Map([['A', { x: 3, y: 1 }], ['B', { x: 1, y: 4 }]]);
    expect(evaluateProductEquation(value, points, { x: 1, y: 1 })?.value).toBe(0);
    expect(evaluateProductEquation(value, points)?.value).toBe(7);
    expect(formatProductEquation(value)).toBe('(vec(A) · vec(B)) = 0');
  });
  it('groups products, hides only the virtual origin and renders literal point names safely', () => {
    const value: VectorProductEquation = { operation: 'cross', terms: [
      { coefficient: 2, left: ['A', 'B'], right: ['C', null] },
      { coefficient: -1, left: [null, 'O'], right: [null, null] },
    ] };
    expect(formatProductEquation(value)).toBe('2 (vec(A, B) × (-vec(C))) = (vec(O) × 0)');
    const latex = formatProductEquation(value, (name) => `${name}_1%{x}\\$&#^~`, 'latex');
    expect(latex).toContain('\\overrightarrow{');
    expect(latex).not.toContain('→');
    expect(() => katex.renderToString(latex, { throwOnError: true, strict: false })).not.toThrow();
  });
  it('defines products of zero vectors and rejects missing references', () => {
    const value = productPredicate('dot', [[1, ['A', 'A'], ['A', 'B']]]);
    if (value.kind !== 'vector-product-equation') throw new Error();
    expect(evaluateProductEquation(value.equation, new Map([['A', { x: 1, y: 2 }], ['B', { x: 3, y: 4 }]]))?.value).toBe(0);
    expect(evaluateProductEquation(value.equation, new Map())).toBeNull();
  });
});
