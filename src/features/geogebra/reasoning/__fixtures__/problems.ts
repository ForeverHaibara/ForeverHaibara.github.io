import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS } from '../../analysis/relations/catalog';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import type { ConditionCandidate, GeometryPredicate, ReasoningProblem } from '../ir/types';

export const candidate = (id: string, predicates: GeometryPredicate[], label = id): ConditionCandidate => ({
  id, label, predicates, source: { kind: 'numerical-observation', relationId: id, snapshot: 123, derivedFrom: [] },
  evidence: { kind: 'single-snapshot' }, diagnostics: [],
});

export const midpointProblem = (): ReasoningProblem => ({
  version: 1, snapshot: 123, diagnostics: [],
  objects: [
    { id: 'a', name: 'A', coordinates: { x: 0, y: 0 } },
    { id: 'b', name: 'B', coordinates: { x: 6, y: 0 } },
    { id: 'c', name: 'C', coordinates: { x: 2, y: 4 } },
    { id: 'm', name: 'M', coordinates: { x: 3, y: 0 } },
    { id: 'n', name: 'N', coordinates: { x: 1, y: 2 } },
  ].map((point) => ({ ...point, objectType: 'point', definition: null, dependencies: [], dependencyStatus: 'free' })),
  candidates: [
    candidate('m-midpoint', [{ kind: 'midpoint', point: 'm', segment: ['a', 'b'] }]),
    candidate('n-midpoint', [{ kind: 'midpoint', point: 'n', segment: ['a', 'c'] }]),
    candidate('midsegment', [{ kind: 'parallel', segments: [['m', 'n'], ['b', 'c']] }]),
    candidate('false-goal', [{ kind: 'perpendicular', segments: [['a', 'b'], ['a', 'c']] }]),
  ],
});

export const discoveredMidpointProblem = (): ReasoningProblem => {
  const graph = buildDependencyGraph([
    { name: 'A', coordinates: { x: 0, y: 0 } }, { name: 'B', coordinates: { x: 6, y: 0 } },
    { name: 'C', coordinates: { x: 2, y: 4 } },
    { name: 'M', coordinates: { x: 3, y: 0 }, commandString: 'Element(Zip((A+B)/2,v,{C}),1)' },
    { name: 'N', coordinates: { x: 1, y: 2 }, commandString: 'unknown(A,C)' },
  ].map((point) => ({ objectType: 'point', commandString: '', ...point })), 123);
  return createDiscoveryProblem(graph, detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, compressConsequences: false }));
};
