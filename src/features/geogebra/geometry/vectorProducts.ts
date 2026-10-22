import type { PointCoordinate } from '../analysis/graphTypes';

/** null denotes the independent coordinate origin, never a constructed point. */
export type VectorReference = [string | null, string | null];
export interface VectorProductTerm { coefficient: number; left: VectorReference; right: VectorReference; }
export interface VectorProductEquation { operation: 'dot' | 'cross'; terms: VectorProductTerm[]; }

export const productPoints = (equation: VectorProductEquation): string[] => [...new Set(equation.terms.flatMap(
  (term) => [...term.left, ...term.right].filter((point): point is string => point !== null)))];
export const mapProductPoints = (equation: VectorProductEquation, map: (point: string) => string): VectorProductEquation => ({
  ...equation, terms: equation.terms.map((term) => ({ ...term,
    left: term.left.map((point) => point === null ? null : map(point)) as VectorReference,
    right: term.right.map((point) => point === null ? null : map(point)) as VectorReference })),
});

/** Exact integer expansion in position atoms. Direction signs survive endpoint sorting. */
export const productRow = (equation: VectorProductEquation): Record<string, number> => {
  const row: Record<string, number> = {};
  for (const { coefficient, left: [a, b], right: [c, d] } of equation.terms) {
    if (!Number.isSafeInteger(coefficient)) throw new Error('Vector product coefficients must be safe integers.');
    for (const [x, y, sign] of [[b, d, 1], [b, c, -1], [a, d, -1], [a, c, 1]] as const) {
      if (x === null || y === null || equation.operation === 'cross' && x === y) continue;
      const reversed = x > y;
      const key = JSON.stringify(reversed ? [y, x] : [x, y]);
      row[key] = (row[key] ?? 0) + coefficient * sign * (reversed && equation.operation === 'cross' ? -1 : 1);
      if (!Number.isSafeInteger(row[key])) throw new Error('Vector product coefficient budget exceeded.');
    }
  }
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
};
export const productEquationKey = (equation: VectorProductEquation): string => {
  const row = productRow(equation); const entries = Object.entries(row);
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
  const divisor = entries.reduce((value, [, coefficient]) => gcd(value, coefficient), 0) || 1;
  const sign = entries[0]?.[1] < 0 ? -1 : 1;
  return JSON.stringify([equation.operation, entries.map(([key, value]) => [key, value * sign / divisor])]);
};
export const homogeneousProduct = (equation: VectorProductEquation): boolean => equation.terms.every(
  (term) => term.left.every((point) => point !== null) && term.right.every((point) => point !== null));

/** Evaluate the original displacement expression, avoiding cancellation in position atoms. */
export const evaluateProductEquation = (equation: VectorProductEquation, points: ReadonlyMap<string, PointCoordinate>,
  origin: PointCoordinate = { x: 0, y: 0 }): { value: number; magnitude: number; residual: number } | null => {
  const at = (id: string | null) => id === null ? origin : points.get(id);
  let value = 0; let magnitude = 0;
  for (const term of equation.terms) {
    const [a, b, c, d] = [...term.left, ...term.right].map(at);
    if (!a || !b || !c || !d) return null;
    const ux = b.x - a.x; const uy = b.y - a.y; const vx = d.x - c.x; const vy = d.y - c.y;
    value += term.coefficient * (equation.operation === 'dot' ? ux * vx + uy * vy : ux * vy - uy * vx);
    magnitude += Math.abs(term.coefficient) * Math.hypot(ux, uy) * Math.hypot(vx, vy);
  }
  return Number.isFinite(value) && Number.isFinite(magnitude) ? { value, magnitude, residual: Math.abs(value) / Math.max(1, magnitude) } : null;
};

export type VectorNotation = 'text' | 'latex';

// Point labels are literal text, never TeX commands (or implicit subscripts).
const latexLabel = (label: string): string => `\\text{${label.replace(/[\\{}$&#%_^~]/g, (character) => ({
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
  '%': '\\%', '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
}[character]!))}}`;

/** Hide only the virtual origin; real endpoints and direction signs remain explicit. */
const formatVector = ([a, b]: VectorReference, name: (id: string) => string, notation: VectorNotation): string => {
  const arrow = (...points: string[]) => notation === 'latex'
    ? `\\overrightarrow{${points.map((point) => latexLabel(name(point))).join('\\,')}}`
    : `vec(${points.map(name).join(', ')})`;
  if (a === null) return b === null ? '0' : arrow(b);
  if (b === null) return notation === 'latex' ? `\\left(-${arrow(a)}\\right)` : `(-${arrow(a)})`;
  return arrow(a, b);
};

export const formatVectorProduct = (operation: VectorProductEquation['operation'], left: VectorReference, right: VectorReference,
  name: (id: string) => string = (id) => id, notation: VectorNotation = 'text'): string => {
  const product = `${formatVector(left, name, notation)} ${notation === 'latex'
    ? operation === 'dot' ? '\\cdot' : '\\times' : operation === 'dot' ? '·' : '×'} ${formatVector(right, name, notation)}`;
  return notation === 'latex' ? `\\left(${product}\\right)` : `(${product})`;
};

/** Keep rational proof coefficients exact and distinguish scalar scaling from cross products. */
export const formatProductSum = (parts: Array<{ product: string; coefficient: string }>, notation: VectorNotation = 'text'): string =>
  parts.filter((part) => part.coefficient !== '0').map(({ product, coefficient }, index) => {
    const negative = coefficient.startsWith('-'); const absolute = negative ? coefficient.slice(1) : coefficient;
    const fraction = absolute.match(/^(\d+)\/(\d+)$/);
    const scalar = absolute === '1' ? '' : notation === 'latex'
      ? `${fraction ? `\\frac{${fraction[1]}}{${fraction[2]}}` : absolute}\\,`
      : `${fraction ? `(${absolute})` : absolute} `;
    return `${index ? negative ? ' − ' : ' + ' : negative ? '−' : ''}${scalar}${product}`;
  }).join('') || '0';

export const formatProductEquation = (equation: VectorProductEquation, name: (id: string) => string = (id) => id,
  notation: VectorNotation = 'text'): string => {
  const side = (positive: boolean) => formatProductSum(equation.terms.filter((term) => term.coefficient !== 0 && (term.coefficient > 0) === positive)
    .map((term) => ({ coefficient: String(Math.abs(term.coefficient)), product: formatVectorProduct(equation.operation, term.left, term.right, name, notation) })), notation);
  return `${side(true)} = ${side(false)}`;
};
