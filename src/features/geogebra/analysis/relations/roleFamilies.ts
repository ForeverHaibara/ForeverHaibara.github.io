import type { RelationCondition, RelationWitness } from '../geometryTypes';
import type { DiscoveryBudget } from './catalog';
import type { RelationSeed } from './relationSeed';
import { segmentKey } from '../algebra/lengthConstraint';

const conditionKey = (condition: RelationCondition) => {
  const terms = condition.equation.terms.map((term) => ({ coefficient: term.coefficient, key: JSON.stringify([term.quantity.kind,
    term.quantity.kind === 'length' ? [...term.quantity.points].sort() : [term.quantity.points[1], [term.quantity.points[0], term.quantity.points[2]].sort()]]) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const pi = condition.equation.pi;
  return [1, -1].map((sign) => JSON.stringify([pi ? [sign * pi.numerator, pi.denominator] : null,
    terms.map((term) => [term.key, sign * term.coefficient])])).sort()[0];
};

/** Only the predicate's declared symmetries are used. In a triangle pair,
 * permutation of corresponding columns and exchange of the WHOLE triangles
 * are valid; swapping the ends of an individual column is not. */
const signature = (witness: RelationWitness, hole: string): string | undefined => {
  const used = [...(witness.triangles ?? []), ...(witness.segments ?? []), ...(witness.angles ?? []),
    ...(witness.equation?.terms.map((term) => term.quantity.points) ?? [])].flat();
  if (!used.includes(hole)) return undefined;
  const name = (value: string) => value === hole ? null : value;
  const segment = (points: string[]) => points.map(name).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (witness.triangles?.length === 2) {
    const [a, b] = witness.triangles;
    const keys = [false, true].map((reverse) => JSON.stringify(a.map((_, i) => (reverse ? [b[i], a[i]] : [a[i], b[i]]).map(name)).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))));
    return keys.sort()[0];
  }
  if (witness.segments) return JSON.stringify(witness.segments.map(segment).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const angle = (points: [string, string, string]) => [name(points[1]), segment([points[0], points[2]])];
  if (witness.angles) return JSON.stringify(witness.angles.map(angle).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if (witness.equation && witness.equation.terms.every((term) => !term.equivalents || term.equivalents.length === 1)) {
    return JSON.stringify([witness.equation.pi, witness.equation.terms.map((term) => [term.coefficient, term.quantity.kind,
      term.quantity.kind === 'length' ? segment(term.quantity.points) : angle(term.quantity.points)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  }
  return undefined;
};

/** Bounded one-hole projections. Grouping is a finite presentation operation,
 * not a universality test, independence test or fitted-locus inference. */
export const groupRoleFamilies = (seeds: RelationSeed[], budget: DiscoveryBudget): RelationSeed[] => {
  const buckets = new Map<string, Array<{ seed: RelationSeed; binding: string }>>();
  for (const seed of seeds) {
    if (seed.model || seed.lengthModel || seed.family || seed.derived) continue;
    const witness = seed.witness;
    // Large equivalence classes are already compressed. Repeatedly sorting
    // thousands of their quantities for each hole defeats a projection budget.
    if (witness.triangles && witness.triangles.length !== 2) continue;
    if (!witness.triangles && !witness.segments && !witness.angles && !witness.equation) continue;
    if ((witness.segments?.length ?? 0) > 8 || (witness.angles?.length ?? 0) > 8 || (witness.equation?.terms.length ?? 0) > 8) {
      budget.note('Role template size limit (8 quantities) reached; larger equivalence classes retained as existing groups.'); continue;
    }
    if (witness.equation?.terms.some((term) => (term.equivalents?.length ?? 0) > 1)) continue;
    const roles = [...(witness.triangles ?? []), ...(witness.segments ?? []), ...(witness.angles ?? []),
      ...(witness.equation?.terms.map((term) => term.quantity.points) ?? [])].flat();
    const names = [...new Set(roles)].sort();
    if (names.length > 16) { budget.note('Role projection mask limit (16 per observation) reached; larger observations retained individually.'); continue; }
    for (const hole of names) {
      if (!budget.take('Role projections', 200000)) break;
      const key = signature(seed.witness, hole);
      if (!key) continue;
      const id = `${seed.kind}:${key}`;
      if (!buckets.has(id) && buckets.size >= 2048) { budget.note('Role family index limit (2048) reached; remaining observations retained individually.'); continue; }
      const bucket = buckets.get(id) ?? []; bucket.push({ seed, binding: hole }); buckets.set(id, bucket);
    }
  }
  const covered = new Set<RelationSeed>();
  const families: RelationSeed[] = [];
  for (const [id, bucket] of [...buckets].sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b))) {
    const members = bucket.filter(({ seed }) => !covered.has(seed));
    if (members.length < 3 || new Set(members.map(({ binding }) => binding)).size !== members.length) continue;
    if (!budget.take('Role families', 64)) break;
    const reference = members[0];
    const fixed = reference.seed.witness.points.filter((name) => name !== reference.binding
      && members.every(({ seed, binding }) => name !== binding && seed.witness.points.includes(name))).sort();
    const commonConditions = (reference.seed.witness.conditions ?? []).filter((condition) => members.every(({ seed }) => seed.witness.conditions?.some((other) => conditionKey(other) === conditionKey(condition))));
    const scoringGroups = members.flatMap(({ seed }) => seed.scoringGroups ?? [seed.scoringNames ?? seed.support?.effective ?? seed.witness.points]);
    const effective = [...new Set(scoringGroups.flat())].sort();
    const points = new Set(members.flatMap(({ seed }) => [...seed.points]));
    families.push({ ...reference.seed, key: `family:${id}`, points, scoringNames: undefined, scoringGroups,
      witness: { ...reference.seed.witness, points: [...new Set(members.flatMap(({ seed }) => seed.witness.points))].sort() },
      support: { effective, guards: [...new Map(members.flatMap(({ seed }) => seed.support?.guards ?? []).map((segment) => [segmentKey(segment), segment])).values()], frame: [],
        assumptions: [...new Set(members.flatMap(({ seed }) => seed.support?.assumptions ?? []))].sort(),
        reason: 'Finite role family; value is the maximum over member conditions. No untested bindings are inferred.' },
      family: { fixed, commonConditions, instances: members.map(({ seed, binding }) => ({ binding, sourceId: seed.key, witness: seed.witness })) } });
    members.forEach(({ seed }) => covered.add(seed));
  }
  return [...seeds.filter((seed) => !covered.has(seed)), ...families];
};
