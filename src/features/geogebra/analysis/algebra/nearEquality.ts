import type { DiscoveryBudget } from '../relations/catalog';

export interface MetricDomain<T> {
  bucket(value: T): readonly number[];
  matches(a: T, b: T): boolean;
}

/** Bounded-diameter groups. A≈B≈C chains never imply A≈C. */
export const groupNearValues = <T>(values: readonly T[], domain: MetricDomain<T>, budget: DiscoveryBudget, resource: string, limit: number): T[][] => {
  const groups: T[][] = [];
  const buckets = new Map<string, number[]>();
  for (const value of values) {
    const cell = domain.bucket(value);
    const candidates = new Set<number>();
    const visit = (axis: number, key: number[]) => {
      if (axis === cell.length) { (buckets.get(key.join(':')) ?? []).forEach((index) => candidates.add(index)); return; }
      for (let offset = -1; offset <= 1; offset += 1) visit(axis + 1, [...key, cell[axis] + offset]);
    };
    visit(0, []);
    let found = -1;
    for (const index of candidates) {
      let matches = true;
      for (const member of groups[index]) {
        if (!budget.take(resource, limit)) return groups;
        if (!domain.matches(value, member)) { matches = false; break; }
      }
      if (matches) { found = index; break; }
    }
    if (found >= 0) groups[found].push(value);
    else {
      const index = groups.length;
      groups.push([value]);
      const key = cell.join(':');
      buckets.set(key, [...(buckets.get(key) ?? []), index]);
    }
  }
  return groups;
};
