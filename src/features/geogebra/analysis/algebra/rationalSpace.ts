import { GEOMETRY_EPSILON } from '../numericPrecision';
// Exact algebra of observed, lifted affine equations. This is not a proof engine
// or an integer-lattice saturation algorithm. Constants are never pivot columns.
type Fraction = readonly [bigint, bigint];
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { const r = a % b; a = b; b = r; }
  return a;
};
const fraction = (n: bigint, d = 1n): Fraction => {
  if (d === 0n) throw new Error('Zero rational denominator');
  if (d < 0n) { n = -n; d = -d; }
  const divisor = gcd(n, d);
  const result: Fraction = [n / divisor, d / divisor];
  if (result.some((value) => (value < 0n ? -value : value).toString(2).length > 192)) throw new Error('Rational coefficient budget exceeded');
  return result;
};
const add = (a: Fraction, b: Fraction): Fraction => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const multiply = (a: Fraction, b: Fraction): Fraction => fraction(a[0] * b[0], a[1] * b[1]);
type Row = Map<string, Fraction>;
const compareIds = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
interface BasisRow { coefficients: Row; error: number; sources: Set<string>; }
export interface Reduction { key: string; error: number; sources: string[]; redundant: boolean; }

export class RationalRelationSpace {
  private rows = new Map<string, BasisRow>();
  private operations = 0;
  private exceeded = false;
  constructor(private constants: ReadonlySet<string> = new Set(['@pi']), private maxRows = 128, private maxOperations = 200000) {}

  private reduceRow(input: ReadonlyMap<string, Fraction>, initialError: number): BasisRow {
    const result: BasisRow = { coefficients: new Map(input), error: initialError, sources: new Set() };
    for (const [pivot, basis] of [...this.rows].sort(([a], [b]) => compareIds(a, b))) {
      const factor = result.coefficients.get(pivot);
      if (!factor || factor[0] === 0n) continue;
      const negative: Fraction = [-factor[0], factor[1]];
      for (const [id, value] of basis.coefficients) {
        if (++this.operations > this.maxOperations) { this.exceeded = true; throw new Error('Relation-space operation budget exceeded'); }
        const next = add(result.coefficients.get(id) ?? [0n, 1n], multiply(negative, value));
        if (next[0] === 0n) result.coefficients.delete(id); else result.coefficients.set(id, next);
      }
      result.error += Math.abs(Number(factor[0]) / Number(factor[1])) * basis.error;
      basis.sources.forEach((source) => result.sources.add(source));
    }
    return result;
  }

  reduce(coefficients: Readonly<Record<string, number>>, error = 0): Reduction {
    const row = new Map(Object.entries(coefficients).filter(([, value]) => value !== 0).map(([id, value]) => {
      if (!Number.isSafeInteger(value)) throw new Error('Integer coefficients required');
      return [id, fraction(BigInt(value))] as const;
    }));
    try {
      const reduced = this.reduceRow(row, error);
      const key = [...reduced.coefficients].sort(([a], [b]) => compareIds(a, b)).map(([id, [n, d]]) => `${JSON.stringify(id)}:${n}/${d}`).join('|');
      return { key, error: reduced.error, sources: [...reduced.sources].sort(), redundant: reduced.coefficients.size === 0 };
    } catch {
      this.exceeded = true;
      return { key: [...row].sort(([a], [b]) => compareIds(a, b)).map(([id, [n, d]]) => `${JSON.stringify(id)}:${n}/${d}`).join('|'), error: Infinity, sources: [], redundant: false };
    }
  }

  insert(coefficients: Readonly<Record<string, number>>, source: string, error = 0): 'independent' | 'redundant' | 'rejected' {
    if (this.rows.size >= this.maxRows) { this.exceeded = true; return 'rejected'; }
    try {
      const entries = Object.entries(coefficients).filter(([, value]) => value !== 0);
      if (entries.some(([, value]) => !Number.isSafeInteger(value))) return 'rejected';
      const row = this.reduceRow(new Map(entries.map(([id, value]) => [id, fraction(BigInt(value))])), error);
      if (row.coefficients.size === 0) return 'redundant';
      const pivot = [...row.coefficients.keys()].filter((id) => !this.constants.has(id)).sort()[0];
      if (!pivot) return 'rejected'; // Never learn pi=0 from noisy constraints.
      const factor = row.coefficients.get(pivot)!;
      const inverse = fraction(factor[1], factor[0]);
      row.coefficients.forEach((value, id) => row.coefficients.set(id, multiply(value, inverse)));
      row.error *= Math.abs(Number(inverse[0]) / Number(inverse[1]));
      row.sources.add(source);
      this.rows.set(pivot, row);
      return 'independent';
    } catch {
      this.exceeded = true;
      return 'rejected';
    }
  }

  get rank(): number { return this.rows.size; }
  get limited(): boolean { return this.exceeded; }
}

export interface RationalFit { coefficients: number[]; denominator: number; constant: number; residual: number; }

/** Small, bounded enumeration backend; the same solver accepts angles or logs. */
export const fitRationalCombination = (target: number, bases: readonly number[], unit: number, maxCoefficient = 4, maxDenominator = 4): RationalFit | null => {
  if (bases.length > 2 || ![target, unit, ...bases].every(Number.isFinite)) return null;
  let best: RationalFit | null = null;
  let bestCost = Infinity;
  for (let d = 1; d <= maxDenominator; d += 1) {
    for (let a = -maxCoefficient; a <= maxCoefficient; a += 1) {
      for (let b = bases.length > 1 ? -maxCoefficient : 0; b <= (bases.length > 1 ? maxCoefficient : 0); b += 1) {
        if (bases.length === 0 && a !== 0) continue;
        const coefficients = bases.map((_, index) => index === 0 ? a : b);
        const value = coefficients.reduce((sum, coefficient, index) => sum + coefficient * bases[index], 0);
        const constant = unit !== 0 ? Math.round((d * target - value) / unit) : 0;
        if (!Number.isSafeInteger(constant)) continue;
        const residual = Math.abs(d * target - value - constant * unit) / d;
        const cost = d + coefficients.reduce((sum, coefficient) => sum + Math.abs(coefficient), 0) + Math.abs(constant);
        if (residual <= 2 * GEOMETRY_EPSILON && (cost < bestCost || cost === bestCost && residual < best!.residual)) {
          best = { coefficients, denominator: d, constant, residual }; bestCost = cost;
        }
      }
    }
  }
  return best;
};
