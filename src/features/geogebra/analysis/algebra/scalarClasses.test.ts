import { describe, expect, it } from 'vitest';
import { affineClassResidual, groupScalarClasses, scalarClass } from './scalarClasses';
import { DiscoveryBudget } from '../relations/catalog';

describe('bounded scalar equivalence classes', () => {
  it('retains witnesses across symbolic forms without closing near-equality chains', () => {
    const groups = groupScalarClasses([[{ value: 0 }, { value: 1.5 }], [{ value: 0.75 }]], 1, new DiscoveryBudget([]), 'classes', 10);
    expect(groups.map((group) => group.members.map((member) => member.value))).toEqual([[0, 0.75], [1.5]]);
    expect(groups.every((group) => group.maximum - group.minimum <= 1)).toBe(true);
  });
  it('checks the entire cross product rather than just the representatives', () => {
    const a = scalarClass([{ value: 1 }, { value: 1.3 }]); const b = scalarClass([{ value: 2 }, { value: 2.3 }]);
    expect(affineClassResidual(a, b, 2, 0)).toBeCloseTo(0.6);
    expect(affineClassResidual(a, b, -1, 3)).toBeCloseTo(0.6);
  });
  it('can group a dense equality class with linear comparison work', () => {
    const budget = new DiscoveryBudget([]);
    const groups = groupScalarClasses(Array.from({ length: 2000 }, () => [{ value: 1 }]), 1e-7, budget, 'classes', 2000);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2000);
    expect(budget.used('classes')).toBe(1999);
  });
  it('returns only validated members on budget exhaustion', () => {
    const diagnostics: string[] = [];
    const groups = groupScalarClasses([[{ value: 1 }, { value: 1 }, { value: 1 }]], 1e-7, new DiscoveryBudget(diagnostics), 'classes', 1);
    expect(groups[0].members).toHaveLength(2);
    expect(diagnostics.join(' ')).toContain('partial');
  });
});
