import { describe, expect, it } from 'vitest';
import { DiscoveryBudget } from '../relations/catalog';
import { combineExpressions, matchScalarTransform, RationalCombinationIndex } from './scalarSearch';
import { balancedTriples } from '../quantities/candidates';

describe('scalar search shared by additive and positive multiplicative domains', () => {
  it('cancels repeated symbols before checking an identity', () => {
    expect(combineExpressions([[{ a: 1, b: -1 }, 2], [{ a: -2, b: 2 }, 1]])).toEqual({});
  });
  it('indexes affine transformations including negative scale and excludes self matches', () => {
    const values = [1, 2, 3, 10, NaN].map((value) => ({ value }));
    const found = [...matchScalarTransform(values, -1, 4, 1e-8, new DiscoveryBudget([]), 'sum', 100)];
    expect(found.map(([a, b]) => [a.value, b.value])).toEqual([[1, 3], [3, 1]]);
  });
  it('never accepts a value outside tolerance and reports lookup limits even in sparse data', () => {
    const diagnostics: string[] = [];
    expect([...matchScalarTransform([{ value: 1 }, { value: 2.001 }], 2, 0, 1e-5, new DiscoveryBudget(diagnostics), 'twice', 0)]).toEqual([]);
    expect(diagnostics.join(' ')).toContain('lookups limit');
    expect([...matchScalarTransform([{ value: 1 }, { value: 2.001 }], 2, 0, 1e-5, new DiscoveryBudget([]), 'twice', 100)]).toEqual([]);
  });
  it('finds bounded rational combinations with roots, offsets and negative coefficients', () => {
    const index = new RationalCombinationIndex([Math.log(1.73)], [{ value: 0, cost: 0 }, { value: Math.log(2), cost: 1 }]);
    const root = index.fit(Math.log(Math.SQRT2), 1e-9);
    expect(root).toMatchObject({ denominator: 2, offset: 1, coefficients: [0] });
    const inverse = index.fit(Math.log(1 / 1.73), 1e-9);
    expect(inverse).toMatchObject({ denominator: 1, coefficients: [-1], offset: 0 });
    expect(index.fit(Math.log(5.1973921), 1e-12)).toBeNull();
    expect(index.fit(NaN, 1e-9)).toBeNull();
  });
  it('balances partial triples and covers every unordered triple once when untruncated', () => {
    const triples = [...balancedTriples([0, 1, 2, 3, 4, 5])];
    expect(triples).toHaveLength(20);
    expect(new Set(triples.map((triple) => triple.join(','))).size).toBe(20);
    expect(new Set(triples.slice(0, 4).flat()).size).toBe(6);
  });
});
