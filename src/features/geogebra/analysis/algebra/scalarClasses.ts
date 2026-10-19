import type { DiscoveryBudget } from '../relations/catalog';

export interface ScalarClass<T> {
  representative: T;
  members: T[];
  value: number;
  minimum: number;
  maximum: number;
}
export const scalarClass = <T extends { value: number }>(members: T[]): ScalarClass<T> => ({
  representative: members[0], members, value: members[0].value,
  minimum: members.reduce((min, member) => Math.min(min, member.value), Infinity),
  maximum: members.reduce((max, member) => Math.max(max, member.value), -Infinity),
});

/** Sort scalar observations once, then use extrema to validate whole classes.
 * No pairwise clique checks or transitive near-equality chains are needed;
 * approximate symbolic classes are split whenever their diameter is too large. */
export const groupScalarClasses = <T extends { value: number }>(preclasses: readonly T[][], epsilon: number,
  budget: DiscoveryBudget, resource: string, limit: number): ScalarClass<T>[] => {
  const sorted = preclasses.flat().filter((member) => Number.isFinite(member.value)).sort((a, b) => a.value - b.value);
  const groups: ScalarClass<T>[] = []; let members: T[] = [];
  for (const member of sorted) {
    if (members.length) {
      if (!budget.take(resource, limit)) break;
      if (member.value - members[0].value > epsilon) { groups.push(scalarClass(members)); members = []; }
    }
    members.push(member);
  }
  if (members.length) groups.push(scalarClass(members));
  return groups;
};

/** Worst residual over a Cartesian product, computed from interval endpoints. */
export const affineClassResidual = <T>(source: ScalarClass<T>, target: ScalarClass<T>, scale: number, offset: number): number => {
  const first = scale * source.minimum + offset; const last = scale * source.maximum + offset;
  return Math.max(Math.abs(target.minimum - Math.max(first, last)), Math.abs(target.maximum - Math.min(first, last)));
};
