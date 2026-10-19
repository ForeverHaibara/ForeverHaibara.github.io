import type { PointCoordinate } from '../graphTypes';
import { cross, displacement, dot } from './vector';

export type AngleTriple = [string, string, string];
export interface DirectedAngleTerm { angle: AngleTriple; coefficient: number; }
interface Rational { numerator: number; denominator: number; }
export interface DirectionTerm { segment: [string, string]; coefficient: number; }

/** Units are pi radians. These are coordinates on R/Z, not ordinary ray angles. */
export const wrapHalfTurns = (value: number): number => value - Math.round(value);
export const positiveHalfTurns = (value: number): number => ((value % 1) + 1) % 1;
export const directedAngleValue = (a: PointCoordinate, vertex: PointCoordinate, b: PointCoordinate): number | null => {
  const u = displacement(vertex, a); const v = displacement(vertex, b);
  const first = Math.hypot(u.x, u.y); const second = Math.hypot(v.x, v.y);
  if (!Number.isFinite(first) || !Number.isFinite(second) || first < 1e-8 || second < 1e-8) return null;
  const x = { x: u.x / first, y: u.y / first }; const y = { x: v.x / second, y: v.y / second };
  return Math.atan2(cross(x, y), dot(x, y)) / Math.PI;
};

/** Expand angle(a,v,b) = dir(v,b)-dir(v,a), preserving every integer factor. */
export const canonicalDirectionEquation = (terms: readonly DirectedAngleTerm[], pi: Rational) => {
  const rows = new Map<string, DirectionTerm>();
  for (const term of terms) {
    const [a, v, b] = term.angle;
    for (const [end, sign] of [[a, -1], [b, 1]] as const) {
      const segment = [v, end].sort() as [string, string]; const key = JSON.stringify(segment);
      const coefficient = (rows.get(key)?.coefficient ?? 0) + sign * term.coefficient;
      if (coefficient) rows.set(key, { segment, coefficient }); else rows.delete(key);
    }
  }
  const values = [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
  const sign = values[0]?.coefficient < 0 ? -1 : 1;
  if (sign < 0) values.forEach((value) => { value.coefficient *= -1; });
  let numerator = ((sign * pi.numerator % pi.denominator) + pi.denominator) % pi.denominator;
  let denominator = pi.denominator;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(numerator, denominator); numerator /= divisor; denominator /= divisor;
  const constant = { numerator, denominator };
  return { terms: values, constant, key: JSON.stringify([values, constant]) };
};
