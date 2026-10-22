import { describe, expect, it } from 'vitest';
import { vectorProblemB } from '../../reasoning/__fixtures__/vectorProducts';
import { detectGeometryRelations } from '../geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget } from './catalog';
import { buildGeometryScene } from '../scene/geometryScene';
import { detectVectorProductRelations } from './vectorProductRelations';
import { createDiscoveryProblem } from '../../reasoning/sources/discoveryProblem';
import { productEquationKey, productRow } from '../../geometry/vectorProducts';
import { assessLocalConstraint, constraintRank } from '../../reasoning/selection/localConstraints';
import { buildRelationSearchDocument, matchesRelationSearch, parseRelationSearch } from '../../reasoning/selection/relationSearch';
import { exportAg2Proof } from '../../reasoning/backends/ag2/exportProblem';

describe('bounded signed product discovery and reasoning adapters', () => {
  it('finds the two inverse-similarity product equations for the opaque E construction', () => {
    const { graph } = vectorProblemB();
    const allowed = new Set(['A', 'B', 'C', 'D', 'E']);
    const scoped = { ...graph, nodes: graph.nodes.map((node) => allowed.has(node.name) ? node : { ...node, coordinates: undefined }) };
    const found = detectGeometryRelations(scoped, 123, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['dot-products', 'cross-products', 'similar-triangles'], compressConsequences: false });
    const problem = createDiscoveryProblem(scoped, found);
    const candidates = problem.candidates.filter((candidate) => candidate.predicates.some((predicate) => predicate.kind === 'vector-product-equation'));
    expect(candidates.some((candidate) => candidate.predicates[0].kind === 'vector-product-equation' && candidate.predicates[0].equation.operation === 'dot')).toBe(true);
    expect(candidates.some((candidate) => candidate.predicates[0].kind === 'vector-product-equation' && candidate.predicates[0].equation.operation === 'cross')).toBe(true);
    const gradients = candidates.flatMap((candidate) => assessLocalConstraint(candidate.predicates[0], 'object:E', problem.objects)?.gradients ?? []);
    expect(constraintRank(gradients).rank).toBe(2);
    for (const candidate of candidates) {
      const predicate = candidate.predicates[0]; if (predicate.kind !== 'vector-product-equation') throw new Error();
      expect(Object.keys(productRow(predicate.equation)).length).toBeGreaterThan(0);
      expect(predicate.equation.terms.every((term) => [...term.left, ...term.right].every((point) => point !== null))).toBe(true);
      const exported = exportAg2Proof(problem, { acceptedIds: [candidate.id], goalId: candidate.id }).value!;
      expect(exported.ag2Compatible).toBe(false); expect(exported.text).toBe('');
      expect(exported.vectorContext?.assumptions).toHaveLength(1);
    }
  });
  it('keeps canonical discovered equations invariant under reflection, translation and unit changes', () => {
    const keys = (scale: number, mirror: number) => {
      const { graph } = vectorProblemB();
      for (const node of graph.nodes) if (node.coordinates) node.coordinates = { x: (node.coordinates.x + 5) * scale, y: (mirror * node.coordinates.y - 3) * scale };
      return new Set(detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['dot-products', 'cross-products'], compressConsequences: false })
        .relations.map((relation) => productEquationKey(relation.witnesses[0].productEquation!)));
    };
    const base = keys(1, 1);
    for (const [scale, mirror] of [[1e-10, -1], [1e10, 1]]) expect(keys(scale, mirror)).toEqual(base);
  });
  it('reports explicit candidate truncation and respects disabled types', () => {
    const { graph } = vectorProblemB();
    const found = detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['dot-products'], maxAngles: 2 });
    expect(found.diagnostics.some((message) => message.includes('dot-products candidates limit'))).toBe(true);
    expect(found.relations.every((relation) => relation.kind === 'dot-products')).toBe(true);
  });
  it('also budgets the background equations used to compress midpoint consequences', () => {
    const { graph } = vectorProblemB();
    const diagnostics: string[] = [];
    detectVectorProductRelations(buildGeometryScene(graph, diagnostics), [{ kind: 'midpoint', key: 'midpoint',
      confidence: 1, points: new Set(), witness: { points: ['B', 'D', 'F'], midpoint: { point: 'F', segment: ['B', 'D'] } } }],
    { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['dot-products'], maxComparisons: 1 }, new DiscoveryBudget(diagnostics));
    expect(diagnostics.some((message) => message.includes('dot-products background constraints limit'))).toBe(true);
  });
  it('indexes both vector factors and the product kind in structured relation search', () => {
    const { problem } = vectorProblemB(); const candidate = problem.candidates.find((entry) => entry.id === 'inverse-cross')!;
    const search = buildRelationSearchDocument(candidate, undefined, problem.objects);
    expect(matchesRelationSearch(search, parseRelationSearch('叉乘 AB AE', problem.objects))).toBe(true);
    expect(matchesRelationSearch(search, parseRelationSearch('点乘 AB AE', problem.objects))).toBe(false);
  });
});
