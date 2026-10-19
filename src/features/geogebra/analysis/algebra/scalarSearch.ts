import type { DiscoveryBudget } from '../relations/catalog';

export type IntegerExpression = Readonly<Record<string, number>>;
export const combineExpressions = (terms: ReadonlyArray<readonly [IntegerExpression, number]>): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const [row, coefficient] of terms) for (const [id, value] of Object.entries(row)) result[id] = (result[id] ?? 0) + coefficient * value;
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== 0));
};

/** Indexed affine matching on any additive scalar domain, including log L.
 * Each candidate is still verified by its caller in the original domain. */
export function* matchScalarTransform<T extends { value: number }>(values: readonly T[], scale: number, offset: number, epsilon: number,
  budget: DiscoveryBudget, resource: string, limit: number, includeSelf = false): Generator<readonly [T, T]> {
  const sorted = values.filter((value) => Number.isFinite(value.value)).slice().sort((a, b) => a.value - b.value);
  for (const source of sorted) {
    if (!budget.take(`${resource} lookups`, limit)) return;
    const target = scale * source.value + offset;
    let low = 0; let high = sorted.length;
    while (low < high) { const mid = (low + high) >>> 1; if (sorted[mid].value < target - epsilon) low = mid + 1; else high = mid; }
    for (let i = low; i < sorted.length && sorted[i].value <= target + epsilon; i += 1) {
      if (!budget.take(resource, limit)) return;
      if (includeSelf || sorted[i] !== source) yield [source, sorted[i]];
    }
  }
}

export interface CombinationOffset { value: number; cost: number; }
export interface IndexedCombination { coefficients: number[]; denominator: number; offset: number; value: number; cost: number; }

/** Build once per local basis instead of enumerating coefficients per object.
 * Offsets may be pi multiples, log rational constants, or other fixed units. */
export class RationalCombinationIndex {
  private entries: IndexedCombination[] = [];
  constructor(bases: readonly number[], offsets: readonly CombinationOffset[], maxCoefficient = 4, maxDenominator = 4) {
    if (bases.length > 2 || !bases.every(Number.isFinite)) return;
    const visit = (coefficients: number[]) => {
      if (coefficients.length < bases.length) {
        for (let a = -maxCoefficient; a <= maxCoefficient; a += 1) visit([...coefficients, a]);
        return;
      }
      const sum = coefficients.reduce((value, a, i) => value + a * bases[i], 0);
      for (let denominator = 1; denominator <= maxDenominator; denominator += 1) offsets.forEach((offset, i) => {
        const value = (sum + offset.value) / denominator;
        if (Number.isFinite(value)) this.entries.push({ coefficients, denominator, offset: i, value,
          cost: denominator + coefficients.reduce((cost, a) => cost + Math.abs(a), 0) + offset.cost });
      });
    };
    visit([]);
    this.entries.sort((a, b) => a.value - b.value || a.cost - b.cost);
  }
  fit(target: number, epsilon: number): (IndexedCombination & { residual: number }) | null {
    if (!Number.isFinite(target)) return null;
    let low = 0; let high = this.entries.length;
    while (low < high) { const mid = (low + high) >>> 1; if (this.entries[mid].value < target - epsilon) low = mid + 1; else high = mid; }
    let best: (IndexedCombination & { residual: number }) | null = null;
    for (let i = low; i < this.entries.length && this.entries[i].value <= target + epsilon; i += 1) {
      const entry = this.entries[i]; const residual = Math.abs(entry.value - target);
      if (!best || entry.cost < best.cost || entry.cost === best.cost && residual < best.residual) best = { ...entry, residual };
    }
    return best;
  }
}
