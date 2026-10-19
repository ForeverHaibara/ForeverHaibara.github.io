import type { LengthModel } from '../geometryTypes';

export type Segment = [string, string];
export const segmentKey = (segment: Segment): string => JSON.stringify([...segment].sort());
export const integerGcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return a;
};

/** All quantities are positive lengths already checked by the scene provider.
 * The guards remain attached even when their symbols cancel from the row. */
export const normalizeLengthConstraint = (model: Pick<LengthModel, 'anchor' | 'generators'>, member: LengthModel['members'][number]) => {
  const row = new Map<string, number>();
  const add = (id: string, coefficient: number) => {
    const next = (row.get(id) ?? 0) + coefficient;
    if (next === 0) row.delete(id); else row.set(id, next);
  };
  add(segmentKey(member.segment), member.denominator);
  add(segmentKey(model.anchor), -member.denominator + member.coefficients.reduce((sum, value) => sum + value, 0));
  member.coefficients.forEach((coefficient, i) => add(segmentKey(model.generators[i]), -coefficient));
  const factor = (value: number, sign: number) => {
    for (let prime = 2; prime * prime <= value; prime += 1) while (value % prime === 0) { add(`@factor:${prime}`, sign); value /= prime; }
    if (value > 1) add(`@factor:${value}`, sign);
  };
  factor(member.ratio[0], -1); factor(member.ratio[1], 1);
  const divisor = [...row.values()].reduce(integerGcd, 0) || 1;
  const divisorErrorScale = 1 / divisor;
  for (const [id, coefficient] of row) row.set(id, coefficient / divisor);
  const segments = [...row.keys()].filter((id) => !id.startsWith('@')).map((id) => JSON.parse(id) as Segment);
  const guards = [...new Map([member.segment, model.anchor, ...model.generators].map((segment) => [segmentKey(segment), segment])).values()];
  return { row, segments, guards, identity: row.size === 0, errorScale: divisorErrorScale };
};

/** Isolate an actual remaining variable, not necessarily the original target:
 * d log X = log X + log Y must display X=Y rather than X²=X·Y. */
export const describeLengthConstraint = (model: Pick<LengthModel, 'anchor' | 'generators'>, member: LengthModel['members'][number]) => {
  const constraint = normalizeLengthConstraint(model, member);
  if (constraint.identity) return null;
  const preferred = segmentKey(member.segment);
  const targetId = constraint.row.has(preferred) ? preferred : [...constraint.row.keys()].filter((id) => !id.startsWith('@')).sort()[0];
  if (!targetId) return null;
  const coefficient = constraint.row.get(targetId)!;
  const sign = Math.sign(coefficient);
  return { target: JSON.parse(targetId) as Segment, description: {
    denominator: Math.abs(coefficient),
    terms: new Map([...constraint.row].filter(([id]) => id !== targetId).map(([id, value]) => [id, -sign * value])),
  } };
};
