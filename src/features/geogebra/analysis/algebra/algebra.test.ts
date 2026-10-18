import { describe, expect, it } from 'vitest';
import { fitRationalCombination, RationalRelationSpace } from './rationalSpace';
import { groupNearValues } from './nearEquality';
import { DiscoveryBudget } from '../relations/catalog';
import { groupCircularValues } from '../equivalence';
import { cross, dot, orientedDoubleArea, polarEvaluation, powerOfCircle, tangentPower } from '../quantities/vector';

describe('observed rational relation space', () => {
  it('keeps pi branches when dividing a lifted modular relation', () => {
    const space = new RationalRelationSpace();
    space.insert({ a: 2, b: -2, '@pi': -1 }, 'half-turn');
    expect(space.reduce({ a: 2, b: -2, '@pi': -1 }).redundant).toBe(true);
    expect(space.reduce({ a: 1, b: -1 }).redundant).toBe(false);
    expect(space.reduce({ a: 1 }).key).not.toBe(space.reduce({ b: 1 }).key);
  });
  it('compresses consequences and retains source/error information', () => {
    const space = new RationalRelationSpace();
    expect(space.insert({ a: 1, b: -1 }, 'ab', 1e-8)).toBe('independent');
    space.insert({ b: 1, c: -1 }, 'bc', 2e-8);
    const result = space.reduce({ a: 1, c: -1 });
    expect(result.redundant).toBe(true);
    expect(result.sources).toEqual(['ab', 'bc']);
    expect(result.error).toBeCloseTo(3e-8, 12);
    expect(space.rank).toBe(2);
    expect(space.insert({ '@pi': 1 }, 'contradiction')).toBe('rejected');
  });
  it('finds small rational fits for both angles and logarithms, without inventing arbitrary coefficients', () => {
    const a = 0.718365; const b = 1.123899;
    expect(fitRationalCombination((a + b + Math.PI) / 2, [a, b], Math.PI)).toMatchObject({ denominator: 2, coefficients: [1, 1], constant: 1 });
    expect(fitRationalCombination(Math.log(12), [Math.log(2), Math.log(3)], 0)).toMatchObject({ coefficients: [2, 1], denominator: 1 });
    expect(fitRationalCombination(0.314159265, [a, b], Math.PI)).toBeNull();
  });
  it('respects row budgets and rejects noninteger inputs', () => {
    const space = new RationalRelationSpace(new Set(), 1);
    expect(space.insert({ x: 1, y: -1 }, 'xy')).toBe('independent');
    expect(space.insert({ y: 1, z: -1 }, 'yz')).toBe('rejected');
    expect(new RationalRelationSpace().insert({ x: 0.5 }, 'bad')).toBe('rejected');
  });
  it('uses the same column ordering for pivots and elimination across insertion orders', () => {
    const rows: Array<Record<string, number>> = [{ 'l:1:2': 1, 'l:10:2': -1 }, { 'l:10:2': 1, 'l:2:3': -1 }];
    for (const order of [rows, [...rows].reverse()]) {
      const space = new RationalRelationSpace();
      order.forEach((row, i) => space.insert(row, `r${i}`));
      expect(space.reduce({ 'l:1:2': 1 }).key).toBe(space.reduce({ 'l:2:3': 1 }).key);
    }
  });
  it('falls back without false redundancy when the exact-operation budget is exhausted', () => {
    const space = new RationalRelationSpace(new Set(), 128, 0);
    space.insert({ x: 1, y: -1 }, 'xy');
    const reduced = space.reduce({ x: 1, y: -1 });
    expect(reduced.redundant).toBe(false);
    expect(reduced.error).toBe(Infinity);
    expect(space.limited).toBe(true);
  });
});

describe('shared metric matching', () => {
  it('does not turn a numerical proximity chain into a three-member equality', () => {
    const groups = groupNearValues([0, 0.75, 1.5], { bucket: (v) => [Math.floor(v)], matches: (a, b) => Math.abs(a - b) <= 1 }, new DiscoveryBudget([]), 'test', 100);
    expect(groups.every((group) => group.every((a) => group.every((b) => Math.abs(a - b) <= 1)))).toBe(true);
  });
  it('handles circular seams with bounded diameter and avoids dense-bucket quadratic unions', () => {
    const values = [Math.PI - 1e-8, 1e-8, Math.PI / 2];
    expect(groupCircularValues(values, 1e-7, Math.PI).some((group) => group.includes(0) && group.includes(1))).toBe(true);
    expect(groupCircularValues(Array.from({ length: 10000 }, () => 0), 1e-7, Math.PI)).toHaveLength(1);
  });
  it('reports comparison limits', () => {
    const diagnostics: string[] = [];
    groupNearValues([0, 0, 0], { bucket: () => [0], matches: () => true }, new DiscoveryBudget(diagnostics), 'test', 0);
    expect(diagnostics.join(' ')).toContain('partial');
  });
});

describe('vector primitives and circle quadratic form', () => {
  it('uses dot/cross products for perpendicularity, parallelism and area', () => {
    expect(dot({ x: 2, y: 0 }, { x: 0, y: 3 })).toBe(0);
    expect(cross({ x: 2, y: 0 }, { x: 4, y: 0 })).toBe(0);
    expect(orientedDoubleArea({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 3 })).toBe(6);
  });
  it('unifies circle power, the tangent line and its polar equation', () => {
    const center = { x: 0, y: 0 }; const onCircle = { x: 2, y: 0 };
    expect(powerOfCircle(onCircle, center, 2)).toBe(0);
    expect(tangentPower(center, 2, onCircle, { x: 0, y: 1 })).toBe(0);
    expect(polarEvaluation({ x: 2, y: 7 }, onCircle, center, 2)).toBe(0);
    expect(tangentPower(center, 2, onCircle, { x: 0, y: 0 })).toBeNull();
  });
});
