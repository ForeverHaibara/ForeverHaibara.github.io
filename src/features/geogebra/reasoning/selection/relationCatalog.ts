import { canonicalDirectionEquation } from '../../analysis/quantities/directedAngles';
import type { ConditionCandidate, GeometryPredicate, ReasoningProblem } from '../ir/types';
import type { ConditionSelection } from '../ir/types';
import { predicatePoints } from '../ir/types';
import type { GeometryRelation, GeometryRelationKind } from '../../analysis/geometryTypes';
import { displayScore } from '../../analysis/presentation/formatRelation';

const rational = (numerator: number, denominator: number) => {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
  const divisor = gcd(numerator, denominator) || 1;
  return [numerator / divisor, denominator / divisor];
};

/** Only declared predicate symmetries; ordinary angles retain their ray meaning. */
export const predicateIdentity = (predicate: GeometryPredicate): string => {
  const segment = (names: string[]) => [...names].sort();
  if (predicate.kind === 'directed-angle-equation') return `directed:${canonicalDirectionEquation(predicate.terms, predicate.pi).key}`;
  if ('points' in predicate) return JSON.stringify([predicate.kind, segment(predicate.points)]);
  if ('segments' in predicate) return JSON.stringify([predicate.kind, predicate.segments.map(segment).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  if (predicate.kind === 'midpoint') return JSON.stringify([predicate.kind, predicate.point, segment(predicate.segment)]);
  const terms = new Map<string, number>();
  if (predicate.kind === 'ordinary-angle-equation') {
    for (const term of predicate.terms) {
      const [a, v, b] = term.angle; const key = JSON.stringify([v, segment([a, b])]);
      terms.set(key, (terms.get(key) ?? 0) + term.coefficient);
    }
  } else if ('constant' in predicate) for (const term of predicate.terms) {
    const key = JSON.stringify(segment(term.segment)); terms.set(key, (terms.get(key) ?? 0) + term.coefficient);
  }
  const rows = [...terms].filter(([, coefficient]) => coefficient).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const sign = rows[0]?.[1] < 0 ? -1 : 1;
  const constant = 'pi' in predicate ? predicate.pi : predicate.constant;
  const [numerator, denominator] = predicate.kind === 'length-product' && sign < 0
    ? rational(constant.denominator, constant.numerator) : rational(constant.numerator * (predicate.kind === 'length-product' ? 1 : sign), constant.denominator);
  // Integer factors of a modular direction equation are deliberately retained.
  return JSON.stringify([predicate.kind, rows.map(([key, coefficient]) => [key, coefficient * sign]), numerator, denominator]);
};

const candidateIdentity = (candidate: ConditionCandidate) => candidate.predicates.length
  ? JSON.stringify([...new Set(candidate.predicates.map(predicateIdentity))].sort()) : `unsupported:${candidate.id}`;

/** One catalog for numerical discovery and local suggestions. Equal conjunctions
 * share a row; every old ID remains resolvable for proposal selection/export. */
export const mergeRelationCatalog = (base: ReasoningProblem | null, local: ReasoningProblem | null) => {
  const template = base ?? local;
  const aliases = new Map<string, string>();
  if (!template) return { problem: null, aliases };
  const byPredicate = new Map<string, ConditionCandidate>();
  for (const candidate of [...(base?.candidates ?? []), ...(local?.candidates ?? [])]) {
    const key = candidateIdentity(candidate); const previous = byPredicate.get(key);
    aliases.set(candidate.id, previous?.id ?? candidate.id);
    if (!previous) { byPredicate.set(key, candidate); continue; }
    const evidence = candidate.evidence.kind === 'sampled' ? candidate.evidence : previous.evidence;
    byPredicate.set(key, { ...previous, evidence,
      diagnostics: [...new Set([...previous.diagnostics, ...candidate.diagnostics])],
      hypothesisEligible: previous.hypothesisEligible || candidate.hypothesisEligible,
      characterization: previous.characterization ?? candidate.characterization,
      source: { ...previous.source, derivedFrom: [...new Set([...previous.source.derivedFrom, ...candidate.source.derivedFrom])] },
    });
  }
  return { problem: { ...template, candidates: [...byPredicate.values()],
    diagnostics: [...new Set([...(base?.diagnostics ?? []), ...(local?.diagnostics ?? [])])] }, aliases };
};

export const resolveCatalogIds = (ids: readonly string[], aliases: ReadonlyMap<string, string>): string[] =>
  [...new Set(ids.map((id) => aliases.get(id) ?? id))];

/** Pool expansion can replace a local row ID with a discovered row ID while
 * keeping exactly the same predicate. A new construction is handled upstream. */
export const retainCatalogSelection = (selection: ConditionSelection, before: ReasoningProblem | null, after: ReasoningProblem,
  aliases: ReadonlyMap<string, string>): ConditionSelection => {
  const resolve = (id: string): string | null => {
    const old = before?.candidates.find((candidate) => candidate.id === id);
    const current = after.candidates.find((candidate) => candidate.id === (aliases.get(id) ?? id));
    return old && current && candidateIdentity(old) === candidateIdentity(current) ? current.id : null;
  };
  return { ...selection, acceptedIds: [...new Set(selection.acceptedIds.flatMap((id) => resolve(id) ?? []))], goalId: selection.goalId ? resolve(selection.goalId) : null };
};

export type CatalogView = 'all' | 'accepted' | 'goal' | 'rejected';
export interface CatalogEntry { candidate: ConditionCandidate; relation?: GeometryRelation; }
export const buildCatalogEntries = (problem: ReasoningProblem | null, relations: readonly GeometryRelation[], aliases: ReadonlyMap<string, string>): CatalogEntry[] => {
  const byId = new Map(relations.map((relation) => [aliases.get(relation.id) ?? relation.id, relation]));
  return (problem?.candidates ?? []).map((candidate) => ({ candidate, relation: byId.get(candidate.id) }));
};

export const filterCatalogEntries = (entries: readonly CatalogEntry[], problem: ReasoningProblem | null, selection: ConditionSelection,
  filter: { view: CatalogView; search: string; minimumValue: number; visibleKinds: readonly GeometryRelationKind[];
    computedKinds: readonly GeometryRelationKind[]; selectedOnly: boolean; selectedNames: readonly string[] }): CatalogEntry[] => {
  const query = filter.search.trim().toLocaleLowerCase();
  const names = new Map(problem?.objects.map((object) => [object.id, object.name]));
  return entries.filter(({ candidate, relation }) => {
    if (filter.view === 'accepted' && !selection.acceptedIds.includes(candidate.id)
      || filter.view === 'goal' && selection.goalId !== candidate.id
      || filter.view === 'rejected' && !candidate.hypothesisEligible) return false;
    // Accepted/goal views always allow reviewing hidden selections. Display
    // filters never mutate the accepted set or the source candidate pool.
    if (filter.view === 'all' && relation && (!filter.visibleKinds.includes(relation.kind)
      || !filter.computedKinds.includes(relation.kind) || displayScore(relation.nonTriviality) < filter.minimumValue)) return false;
    const points = relation?.pointNames ?? [...new Set(candidate.predicates.flatMap(predicatePoints).map((id) => names.get(id) ?? id))];
    if (filter.view === 'all' && filter.selectedOnly && filter.selectedNames.length && !filter.selectedNames.some((name) => points.includes(name))) return false;
    return !query || `${candidate.label} ${points.join(' ')} ${candidate.diagnostics.join(' ')}`.toLocaleLowerCase().includes(query);
  });
};
