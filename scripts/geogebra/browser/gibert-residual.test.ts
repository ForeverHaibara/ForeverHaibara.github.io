import { describe, expect, it } from 'vitest';
import { compareGibertResidual as compare } from './gibert-residual';

describe('Gibert equation residual policy', () => {
  it('allows the recorded near-root residuals without dividing by a zero target', () => {
    for (const residual of [2.80e-8, 7.52e-7, 1.26e-7, 7.42e-8, 4.47e-7]) {
      expect(compare(residual, 0, 1).accepted).toBe(true);
      expect(compare(residual, 0, 1).strictDiagnosticPassed).toBe(false);
    }
    expect(compare(1e-3, 0, 1).accepted).toBe(false);
  });
  it('is invariant under nonzero equation gauges, including very small ones', () => {
    for (const factor of [1e-100, -1e-100, 1, -1, 1e100]) {
      expect(compare(5e-7 * factor, 0, Math.abs(factor)).accepted).toBe(true);
      expect(compare(1e-3 * factor, 0, Math.abs(factor)).accepted).toBe(false);
      expect(compare(1000000.5 * factor, 1000000 * factor, Math.abs(factor)).accepted).toBe(true);
    }
  });
  it('rejects invalid scales and nonfinite evaluations', () => {
    for (const args of [[0,0,0],[0,0,-1],[NaN,0,1],[Infinity,0,1],[0,Infinity,1],[0,0,Infinity]])
      expect(compare(...args as [number,number,number]).accepted).toBe(false);
  });
});
