import { canonicalDirectionEquation } from '../../analysis/quantities/directedAngles';
import { productEquationKey } from '../../geometry/vectorProducts';
import type { ConditionCandidate, GeometryPredicate, ReasoningProblem } from '../ir/types';
import type { ConditionSelection } from '../ir/types';
import type { GeometryRelation, GeometryRelationKind } from '../../analysis/geometryTypes';
import { ALL_RELATION_KINDS } from '../../analysis/relations/catalog';
import { displayScore } from '../../analysis/presentation/formatRelation';
import { buildRelationSearchDocument, matchesRelationSearch, normalizeSearchText, parseRelationSearch } from './relationSearch';
import type { RelationSearchDocument } from './relationSearch';

const rational = (numerator: number, denominator: number) => {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
  const divisor = gcd(numerator, denominator) || 1;
  return [numerator / divisor, denominator / divisor];
};

/** Only declared predicate symmetries; ordinary angles retain their ray meaning. */
export const predicateIdentity = (predicate: GeometryPredicate): string => {
  if (predicate.kind === 'vector-product-equation') return `vector:${productEquationKey(predicate.equation)}`;
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

/** Suggestions add premises, never replace explicit choices or assume the goal.
 * Rejected evidence still requires the user's explicit hypothesis opt-in. */
export const acceptSuggestedConditions = (selection: ConditionSelection, suggestedIds: readonly string[],
  problem: ReasoningProblem, aliases: ReadonlyMap<string, string>): ConditionSelection => {
  const candidates = new Map(problem.candidates.map((candidate) => [candidate.id, candidate]));
  const additions = resolveCatalogIds(suggestedIds, aliases).filter((id) => {
    const candidate = candidates.get(id);
    return id !== selection.goalId && candidate && candidate.predicates.length && !candidate.diagnostics.length && !candidate.hypothesisEligible;
  });
  return { ...selection, acceptedIds: [...new Set([...selection.acceptedIds, ...additions])] };
};

/** Computation settings can replace the observation pool on the same snapshot.
 * Keep explicit inputs independently; a changed construction is reset upstream. */
export const preserveSelectedCandidates = (current: ReasoningProblem | null, previous: ReasoningProblem | null,
  selection: ConditionSelection) => {
  const selected = new Set([...selection.acceptedIds, ...(selection.goalId ? [selection.goalId] : [])]);
  const existing = new Set(current?.candidates.map((candidate) => candidate.id));
  const retained = previous && (!current || current.snapshot === previous.snapshot)
    ? { ...previous, candidates: previous.candidates.filter((candidate) => selected.has(candidate.id) && !existing.has(candidate.id)) } : null;
  return mergeRelationCatalog(current, retained?.candidates.length ? retained : null);
};

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
export interface CatalogEntry { candidate: ConditionCandidate; relation?: GeometryRelation; search: RelationSearchDocument; }
export const buildCatalogEntries = (problem: ReasoningProblem | null, relations: readonly GeometryRelation[], aliases: ReadonlyMap<string, string>): CatalogEntry[] => {
  const byId = new Map(relations.map((relation) => [aliases.get(relation.id) ?? relation.id, relation]));
  return (problem?.candidates ?? []).map((candidate) => {
    const relation = byId.get(candidate.id);
    return { candidate, relation, search: buildRelationSearchDocument(candidate, relation, problem!.objects) };
  });
};

export interface CatalogFilter {
  search: string;
  minimumValue: number;
  kinds: readonly GeometryRelationKind[];
  selectedOnly: boolean;
  includeUnscored: boolean;
}
export const defaultCatalogFilter = (): CatalogFilter => ({ search: '', minimumValue: 0, kinds: [...ALL_RELATION_KINDS], selectedOnly: false, includeUnscored: true });

export const filterCatalogEntries = (entries: readonly CatalogEntry[], problem: ReasoningProblem | null, selection: ConditionSelection,
  filter: CatalogFilter & { view: CatalogView; selectedNames: readonly string[] }): CatalogEntry[] => {
  const query = parseRelationSearch(filter.search, problem?.objects ?? []);
  return entries.filter(({ candidate, relation, search }) => {
    if (filter.view === 'accepted' && !selection.acceptedIds.includes(candidate.id)
      || filter.view === 'goal' && selection.goalId !== candidate.id
      || filter.view === 'rejected' && !candidate.hypothesisEligible) return false;
    if (!search.kinds.some((kind) => filter.kinds.includes(kind)) && (search.kinds.length || filter.kinds.length !== ALL_RELATION_KINDS.length)) return false;
    if (relation ? displayScore(relation.nonTriviality) < filter.minimumValue : !filter.includeUnscored) return false;
    if (filter.selectedOnly && !filter.selectedNames.some((name) => search.points.has(normalizeSearchText(name)))) return false;
    return matchesRelationSearch(search, query);
  });
};
