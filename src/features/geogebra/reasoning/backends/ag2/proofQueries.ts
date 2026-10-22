import type { ConditionCandidate, GeometryPredicate } from '../../ir/types';

const families: GeometryPredicate['kind'][] = ['concyclic', 'midpoint', 'equal-length', 'perpendicular', 'parallel',
  'collinear', 'directed-angle-equation', 'vector-product-equation', 'length-product', 'length-sum', 'direction-equation', 'coincident'];

/** A query budget should sample geometric kinds, rather than the discovery UI's sort order. */
export const proofQueryCandidates = (candidates: ConditionCandidate[], acceptedIds: readonly string[]): ConditionCandidate[] => {
  const accepted = new Set(acceptedIds);
  const pools = families.map(() => [] as ConditionCandidate[]);
  for (const candidate of candidates) {
    if (accepted.has(candidate.id) || candidate.diagnostics.length || !candidate.predicates.length
      || candidate.predicates.some((predicate) => predicate.kind === 'ordinary-angle-equation')) continue;
    const family = families.findIndex((kind) => candidate.predicates.some((predicate) => predicate.kind === kind));
    if (family >= 0) pools[family].push(candidate);
  }
  const result: ConditionCandidate[] = [];
  for (let index = 0; pools.some((pool) => index < pool.length); index += 1) {
    for (const pool of pools) if (pool[index]) result.push(pool[index]);
  }
  return result;
};
