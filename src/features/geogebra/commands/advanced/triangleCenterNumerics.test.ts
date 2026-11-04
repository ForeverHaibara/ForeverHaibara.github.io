import { describe, expect, it } from 'vitest';
import { createCenterEvaluator, type Point } from './triangleCenterNumerics';
import { loadTriangleCenterCatalogue } from '../custom/builders/triangleCenters';
import fixture from './triangleCenterNumerics.fixture.json';
import { formula } from './coordinateFormula';
describe('snapshot triangle center numerics', () => {
  it('parses powers, unary signs and functions without executing JavaScript', () => {
    expect(formula('-2^2+2^3^2')({})).toBe(508);
    expect(formula('sqrt(a^2)+cot(pi/4)')({ a: 3, pi: Math.PI })).toBeCloseTo(4);
    expect(() => formula('globalThis.alert(1)')).toThrow();
  });
  it('agrees with the independent Python evaluator on both atlas triangles, every operation and all chunks', async () => {
    const catalogue = await loadTriangleCenterCatalogue();
    for (const shape of Object.keys(fixture.triangles) as Array<keyof typeof fixture.triangles>) {
      const native = new Map(Object.entries(fixture.native[shape]).map(([i, p]) => [Number(i), p as unknown as Point]));
      const evaluate = createCenterEvaluator(fixture.triangles[shape] as unknown as Point[], catalogue, native);
      for (const [id, expected] of Object.entries(fixture.expected[shape])) {
        const point = evaluate(Number(id));
        if (!expected)
          expect(point, `X(${id}) ${shape}`).toBeNull();
        else {
          expect(point, `X(${id}) ${shape}`).not.toBeNull();
          const delta = Math.hypot(point![0] - expected[0], point![1] - expected[1]);
          expect(delta / Math.max(1, Math.hypot(...expected)), `X(${id}) ${shape}`).toBeLessThan(1e-6);
        }
      }
    }
  });
});
