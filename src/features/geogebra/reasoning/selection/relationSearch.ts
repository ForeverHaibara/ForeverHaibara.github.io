import type { GeometryRelation, GeometryRelationKind, QuantityEquation, RelationCondition, RelationWitness } from '../../analysis/geometryTypes';
import { RELATION_CATALOG } from '../../analysis/relations/catalog';
import { mapPredicatePoints, predicatePoints } from '../ir/types';
import type { ConditionCandidate, GeometryPredicate, ReasoningProblem } from '../ir/types';

/** Retrieval symmetries only. These keys never change predicates or proof input. */
export const normalizeSearchText = (text: string): string => text.normalize('NFKC').toLocaleLowerCase()
  .replace(/[′’]/g, "'").replace(/[_{}]/g, '');
const pairKey = (points: readonly string[]) => JSON.stringify([...points].sort());
const angleKey = ([a, v, b]: readonly string[]) => JSON.stringify([v, ...[a, b].sort()]);

// Predicate adapters are exhaustive: adding an IR kind requires defining its
// searchable quantities and type facets here, independently of display labels.
const predicateKinds = (predicate: GeometryPredicate): GeometryRelationKind[] => {
  switch (predicate.kind) {
    case 'collinear': case 'concyclic': case 'midpoint': case 'parallel': case 'perpendicular': return [predicate.kind];
    case 'coincident': return ['coincident-points'];
    case 'equal-length': return ['equal-lengths'];
    case 'directed-angle-equation': return ['directed-angles'];
    case 'vector-product-equation': return [predicate.equation.operation === 'dot' ? 'dot-products' : 'cross-products'];
    case 'direction-equation': return ['direction-space'];
    case 'length-product': return ['length-space'];
    case 'length-sum': return ['length-multiple'];
    case 'ordinary-angle-equation': return [predicate.pi.numerator === 0
      ? predicate.terms.some((term) => Math.abs(term.coefficient) !== 1) ? 'angle-multiple' : 'equal-angles'
      : predicate.pi.denominator === 2 ? 'complementary-angles' : 'supplementary-angles'];
    default: { const exhaustive: never = predicate; return exhaustive; }
  }
};

export interface RelationSearchDocument {
  points: Set<string>;
  segments: Set<string>;
  angles: Set<string>;
  triangles: Set<string>;
  /** Direction equations can expose an angle through two incident carriers. */
  directionSegments: Set<string>;
  carriers: string[][];
  angleAliases: Array<{ vertex: string; endpoints: [string[], string[]] }>;
  kinds: GeometryRelationKind[];
  text: string;
}

export const buildRelationSearchDocument = (candidate: ConditionCandidate, relation: GeometryRelation | undefined,
  objects: ReasoningProblem['objects']): RelationSearchDocument => {
  const names = new Map(objects.map((object) => [object.id, normalizeSearchText(object.name)]));
  const name = (id: string) => names.get(id) ?? normalizeSearchText(id);
  const document: RelationSearchDocument = { points: new Set(), segments: new Set(), angles: new Set(), triangles: new Set(),
    directionSegments: new Set(), carriers: [], angleAliases: [], kinds: relation ? [relation.kind] : [...new Set(candidate.predicates.flatMap(predicateKinds))], text: '' };
  const segment = (points: readonly string[]) => { document.segments.add(pairKey(points)); points.forEach((point) => document.points.add(point)); };
  const angle = (points: readonly string[]) => { document.angles.add(angleKey(points)); segment(points.slice(0, 2)); segment(points.slice(1)); };
  for (const raw of candidate.predicates) {
    const predicate = mapPredicatePoints(raw, name);
    if (!('terms' in predicate)) predicatePoints(predicate).forEach((point) => document.points.add(point));
    if (predicate.kind === 'collinear') document.carriers.push(predicate.points);
    if (predicate.kind === 'vector-product-equation') {
      for (const term of predicate.equation.terms) if (term.coefficient) for (const vector of [term.left, term.right]) {
        if (vector[0] !== null && vector[1] !== null) segment(vector as [string, string]);
      }
    }
    else if ('segments' in predicate) predicate.segments.forEach(segment);
    else if (predicate.kind === 'midpoint') {
      segment(predicate.segment); predicate.segment.forEach((point) => segment([predicate.point, point]));
    } else if ('pi' in predicate) predicate.terms.filter((term) => term.coefficient !== 0).forEach((term) => angle(term.angle));
    else if ('terms' in predicate) {
      // Cancel reference/zero terms in generator rows. A frame anchor alone is
      // not an actual quantity of the normalized member constraint.
      const rows = new Map<string, number>();
      for (const term of predicate.terms) { const key = pairKey(term.segment); rows.set(key, (rows.get(key) ?? 0) + term.coefficient); }
      for (const [key, coefficient] of rows) if (coefficient) {
        segment(JSON.parse(key));
        if (predicate.kind === 'direction-equation') document.directionSegments.add(key);
      }
    }
  }
  const equation = (item: QuantityEquation) => {
    for (const term of item.terms) for (const quantity of [term.quantity, ...(term.equivalents ?? [])]) {
      if (quantity.kind === 'length') segment(quantity.points.map(normalizeSearchText));
      else angle(quantity.points.map(normalizeSearchText));
    }
  };
  const condition = (item: RelationCondition) => {
    equation(item.equation);
    if (item.locus) { document.points.add(normalizeSearchText(item.locus.point)); segment(item.locus.segment.map(normalizeSearchText)); }
  };
  const witness = (item: RelationWitness) => {
    if (!relation?.model && !relation?.lengthModel) item.points.forEach((point) => document.points.add(normalizeSearchText(point)));
    item.segments?.forEach((points) => segment(points.map(normalizeSearchText)));
    item.angles?.forEach((points) => angle(points.map(normalizeSearchText)));
    item.triangles?.forEach((points) => {
      const [a, b, c] = points.map(normalizeSearchText);
      document.triangles.add(pairKey([a, b, c]));
      [[a, b, c], [b, c, a], [c, a, b]].forEach(angle);
    });
    if (item.equation) equation(item.equation);
    item.conditions?.forEach(condition);
    for (const lines of item.lineFamilies ?? []) for (const line of lines) document.carriers.push(line.map(normalizeSearchText));
    for (const alias of item.angleAliases ?? []) {
      [...alias.endpoints[0], ...alias.endpoints[1], alias.angle[1]].forEach((point) => document.points.add(normalizeSearchText(point)));
      document.angleAliases.push({ vertex: normalizeSearchText(alias.angle[1]),
        endpoints: [alias.endpoints[0].map(normalizeSearchText), alias.endpoints[1].map(normalizeSearchText)] });
    }
  };
  // Families are finite recorded instances, never a Cartesian completion.
  (relation?.family ? relation.family.instances.map((instance) => instance.witness) : relation?.witnesses ?? []).forEach(witness);
  relation?.family?.commonConditions.forEach(condition);
  const labels = document.kinds.map((kind) => RELATION_CATALOG.find((entry) => entry.kind === kind)?.label ?? kind);
  document.text = normalizeSearchText([candidate.label, ...candidate.diagnostics, ...labels, ...document.kinds].join(' '));
  return document;
};

type QuantityQuery = { kind: 'segment' | 'angle' | 'triangle'; points: string[] };
export interface RelationSearchQuery { points: string[]; quantities: QuantityQuery[]; words: string[]; kinds: GeometryRelationKind[][]; }
// Aliases complement the canonical catalog labels. New kinds automatically
// support their label/key; only additional vocabulary needs an alias entry.
const ALIASES: Array<[RegExp, GeometryRelationKind[]]> = [
  [/点乘|内积|dot(?:\s+products?)?/giu, ['dot-products']], [/叉乘|外积|cross(?:\s+products?)?/giu, ['cross-products']],
  [/有向角|directed(?:\s+angles?)?/giu, ['directed-angles', 'direction-space']],
  [/无向角|普通角|ordinary(?:\s+angles?)?/giu, ['equal-angles', 'angle-multiple', 'complementary-angles', 'supplementary-angles']],
  [/共线|collinear/giu, ['collinear']], [/共圆|concyclic|cyclic/giu, ['concyclic']],
  [/垂直|perpendicular|⊥/giu, ['perpendicular']], [/平行|parallel|∥/giu, ['parallel']],
  [/中点|midpoints?/giu, ['midpoint']], [/等长|等距|equal\s*lengths?/giu, ['equal-lengths']],
  [/相似|similar(?:\s+triangles?)?/giu, ['similar-triangles']], [/全等|congruent(?:\s+triangles?)?/giu, ['congruent-triangles']],
  [/生成元|generators?/giu, ['direction-space', 'length-space']],
];

/** A known-name lexer avoids treating letters inside words as point labels.
 * Compact notation is accepted only when the complete token decomposes. */
export const parseRelationSearch = (query: string, objects: ReasoningProblem['objects']): RelationSearchQuery => {
  let text = normalizeSearchText(query);
  const result: RelationSearchQuery = { points: [], quantities: [], words: [], kinds: [] };
  for (const [pattern, kinds] of ALIASES) text = text.replace(pattern, () => { result.kinds.push(kinds); return ' '; });
  const names = [...new Set(objects.map((object) => normalizeSearchText(object.name)))].sort((a, b) => b.length - a.length);
  const splitNames = (value: string): string[] | null => {
    const memo = new Map<number, string[] | null>();
    const split = (offset: number): string[] | null => {
      if (offset === value.length) return [];
      if (memo.has(offset)) return memo.get(offset)!;
      for (const name of names) if (name && value.startsWith(name, offset)) {
        const tail = split(offset + name.length);
        if (tail) { const found = [name, ...tail]; memo.set(offset, found); return found; }
      }
      memo.set(offset, null); return null;
    };
    return split(0);
  };
  const consume = (value: string, hint?: 'angle' | 'triangle', grouped = false) => {
    // Explicit separators win over compact longest-name matching. Otherwise
    // (A,O) would unexpectedly become the single object AO when it exists.
    const pieces = value.split(/[\s,，;；]+/u).filter(Boolean);
    const parts = pieces.map(splitNames);
    if (parts.some((part) => part === null)) { result.words.push(...pieces); return; }
    const points = parts.flatMap((part) => part ?? []);
    result.points.push(...points);
    if (hint && points.length === 3) result.quantities.push({ kind: hint, points });
    else if (hint === 'angle' && points.length === 4) result.quantities.push({ kind: 'segment', points: points.slice(0, 2) }, { kind: 'segment', points: points.slice(2) });
    else if (points.length === 2) result.quantities.push({ kind: 'segment', points });
    else if (points.length === 3 && (grouped || !/\s/.test(value.trim()))) result.quantities.push({ kind: 'angle', points });
  };
  text = text.replace(/([∠∡△δ]?)\(([^()]*)\)/gu, (_, symbol: string, body: string) => {
    consume(body, symbol === '△' || symbol === 'δ' ? 'triangle' : symbol ? 'angle' : undefined, true); return ' ';
  });
  const escapedNames = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (escapedNames) text = text.replace(new RegExp(`([∠∡△δ])\\s*((?:${escapedNames})\\s*[,，]?\\s*(?:${escapedNames})\\s*[,，]?\\s*(?:${escapedNames}))`, 'gu'),
    (_, symbol: string, body: string) => { consume(body, symbol === '△' || symbol === 'δ' ? 'triangle' : 'angle'); return ' '; });
  for (const token of text.split(/[\s=＝:：,，;；+*/|<>≈~≡≅∼]+/u).filter(Boolean)) {
    const symbol = token[0]; const hint = symbol === '△' || symbol === 'δ' ? 'triangle' : symbol === '∠' || symbol === '∡' ? 'angle' : undefined;
    consume(hint ? token.slice(1) : token, hint);
  }
  return result;
};

export const matchesRelationSearch = (document: RelationSearchDocument, query: RelationSearchQuery): boolean =>
  query.points.every((point) => document.points.has(point))
  && query.kinds.every((kinds) => kinds.some((kind) => document.kinds.includes(kind)))
  && query.words.every((word) => document.text.includes(word))
  && query.quantities.every(({ kind, points }) => {
    if (kind === 'segment') return document.segments.has(pairKey(points)) || document.carriers.some((line) => points.every((point) => line.includes(point)));
    if (kind === 'triangle') return document.triangles.has(pairKey(points));
    const [a, v, b] = points;
    return document.angles.has(angleKey(points))
      || document.directionSegments.has(pairKey([a, v])) && document.directionSegments.has(pairKey([v, b]))
      || document.angleAliases.some((alias) => alias.vertex === v && (
        alias.endpoints[0].includes(a) && alias.endpoints[1].includes(b) || alias.endpoints[0].includes(b) && alias.endpoints[1].includes(a)));
  });
