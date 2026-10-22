import { describe, expect, it } from 'vitest';
import { candidate, midpointProblem } from '../__fixtures__/problems';
import type { GeometryPredicate, ReasoningProblem } from '../ir/types';
import type { GeometryRelation, RelationWitness } from '../../analysis/geometryTypes';
import { buildRelationSearchDocument, matchesRelationSearch, parseRelationSearch } from './relationSearch';

const objects = (names: string[]): ReasoningProblem['objects'] => names.map((name) => ({ ...midpointProblem().objects[0], id: name, name }));
const zero = { numerator: 0, denominator: 1 };
const relation = (witnesses: RelationWitness[], extra: Partial<GeometryRelation> = {}): GeometryRelation => ({
  id: 'group', kind: 'equal-angles', pointNames: [], witnesses, nonTriviality: 0, confidence: 1, explanation: '',
  metric: { constructionSpan: 0, connectedComponents: 1, dependencyCoverage: 1, pointCount: 0 }, ...extra,
});
const matcher = (predicates: GeometryPredicate[], source?: GeometryRelation, names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'O']) => {
  const scope = objects(names);
  const document = buildRelationSearchDocument(candidate('test', predicates, 'short summary'), source, scope);
  return (query: string) => matchesRelationSearch(document, parseRelationSearch(query, scope));
};

describe('structural relation retrieval', () => {
  it.each(['AO CO', 'OA=OC', '(A, O) = (C, O)', '(O A)=(O C)', ' aO , cO ', 'A O C', '等距 OA OC'])('finds equal lengths with flexible notation: %s', (query) => {
    expect(matcher([{ kind: 'equal-length', segments: [['A', 'O'], ['C', 'O']] }])(query)).toBe(true);
  });

  it('requires the queried segments, rather than just their point union', () => {
    const match = matcher([{ kind: 'equal-length', segments: [['A', 'B'], ['C', 'O']] }]);
    expect(match('AO CO')).toBe(false);
    expect(match('A O C')).toBe(true);
    expect(match('AC')).toBe(false);
  });

  it('finds non-anchor angles in a long equality group and preserves the vertex', () => {
    const match = matcher([
      { kind: 'directed-angle-equation', terms: [{ angle: ['A', 'B', 'C'], coefficient: 1 }, { angle: ['D', 'E', 'F'], coefficient: -1 }], pi: zero },
      { kind: 'directed-angle-equation', terms: [{ angle: ['A', 'B', 'C'], coefficient: 1 }, { angle: ['G', 'O', 'H'], coefficient: -1 }], pi: zero },
    ]);
    for (const query of ['DEF GOH', 'FED=HOG', '∡ D E F = ∡ G O H', '∡(D,E,F) ∡(H,O,G)', '有向角 FED HOG']) expect(match(query), query).toBe(true);
    expect(match('DFE GOH')).toBe(false);
    expect(match('ordinary FED HOG')).toBe(false);
  });

  it('indexes all equivalents and finite family instances beyond the displayed representative', () => {
    const source = relation([{ points: ['A', 'B', 'C'], equation: { terms: [{ coefficient: 1, quantity: { kind: 'angle', points: ['A', 'B', 'C'] },
      equivalents: [{ kind: 'angle', points: ['D', 'E', 'F'] }, { kind: 'angle', points: ['G', 'O', 'H'] }] }] } }]);
    expect(matcher([], source)('FED HOG')).toBe(true);
    const family = relation([], { family: { fixed: ['A'], commonConditions: [], instances: [
      { binding: 'B', sourceId: 'first', witness: { points: ['A', 'B', 'C'], angles: [['A', 'B', 'C']] } },
      { binding: 'E', sourceId: 'second', witness: { points: ['D', 'E', 'F'], angles: [['D', 'E', 'F']] } },
    ] } });
    expect(matcher([], family)('DEF')).toBe(true);
    expect(matcher([], family)('AEF')).toBe(false);
  });

  it('searches normalized generator rows, including angles between incident carriers', () => {
    const match = matcher([{ kind: 'direction-equation', terms: [
      { segment: ['A', 'O'], coefficient: 1 }, { segment: ['C', 'O'], coefficient: -1 },
      { segment: ['D', 'E'], coefficient: 3 }, { segment: ['E', 'D'], coefficient: -3 },
    ], constant: zero }]);
    expect(match('AO CO')).toBe(true); expect(match('∡AOC')).toBe(true);
    expect(match('OAC')).toBe(false); expect(match('DE')).toBe(false); expect(match('D')).toBe(false);
    const lengths = matcher([{ kind: 'length-product', terms: [{ segment: ['A', 'O'], coefficient: 2 }, { segment: ['C', 'O'], coefficient: -2 }], constant: { numerator: 1, denominator: 1 } }]);
    expect(lengths('generator OA OC')).toBe(true); expect(lengths('∠AOC')).toBe(false);
  });

  it('supports primed, subscripted and multi-character names with case-insensitive whole-name matching', () => {
    const match = matcher([{ kind: 'equal-length', segments: [["A'", 'O_1'], ['Center', 'O_1']] }], undefined, ["A'", 'O_1', 'Center', 'A', 'O']);
    expect(match('(O₁, A′)=(Center,O_{1})')).toBe(true);
    expect(match("o1a' centerO1")).toBe(true);
    expect(match('A O')).toBe(false);
    expect(match('nonexistent')).toBe(false);
  });

  it('respects explicit name separators when compact names are ambiguous', () => {
    const match = matcher([{ kind: 'equal-length', segments: [['A', 'O'], ['C', 'O']] }], undefined, ['A', 'O', 'C', 'AO', 'CO']);
    expect(match('(A,O)=(C,O)')).toBe(true);
    expect(match('(O A)=(O C)')).toBe(true);
    expect(match('AO CO')).toBe(false); // The two named objects, absent here.
  });

  it('retrieves a line-angle query through its two recorded carriers', () => {
    const match = matcher([{ kind: 'direction-equation', terms: [{ segment: ['A', 'B'], coefficient: 1 }, { segment: ['C', 'D'], coefficient: -1 }], constant: zero }]);
    expect(match('∡(BA,DC)')).toBe(true);
    expect(match('∡(AC,BD)')).toBe(false);
  });

  it('indexes ray aliases with fixed vertex and recorded endpoints only', () => {
    const match = matcher([], relation([{ points: ['A', 'B', 'C'], angleAliases: [{ angle: ['A', 'B', 'C'], endpoints: [['A', 'D'], ['C', 'F']] }] }]));
    expect(match('DBF')).toBe(true); expect(match('FBD')).toBe(true);
    expect(match('BDF')).toBe(false); expect(match('EBF')).toBe(false);
  });

  it('retrieves triangle members and conditional prerequisite quantities', () => {
    const match = matcher([], relation([{ points: ['A', 'B', 'C'], triangles: [['A', 'B', 'C']], conditions: [{ background: false, sourceIds: [], equation: { terms: [
      { coefficient: 1, quantity: { kind: 'length', points: ['D', 'E'] } }, { coefficient: -1, quantity: { kind: 'length', points: ['F', 'G'] } },
    ] } }] }], { kind: 'similar-triangles' }));
    expect(match('△CBA')).toBe(true); expect(match('∠ACB')).toBe(true); expect(match('DE GF')).toBe(true);
  });
});
