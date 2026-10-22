import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import { candidate } from './problems';
import { mapPredicatePoints } from '../ir/types';
import type { GeometryPredicate } from '../ir/types';
import type { SamplingResult } from '../sampling/types';
import type { VectorProductEquation, VectorReference } from '../../geometry/vectorProducts';

export const productPredicate = (operation: VectorProductEquation['operation'],
  terms: Array<[number, VectorReference, VectorReference]>): GeometryPredicate => ({ kind: 'vector-product-equation', equation: {
    operation, terms: terms.map(([coefficient, left, right]) => ({ coefficient, left, right })),
  } });
const make = (coordinates: Record<string, [number, number]>, definitions: Record<string, string>) => {
  const graph = buildDependencyGraph(Object.entries(coordinates).map(([name, [x, y]]) => ({ name, coordinates: { x, y },
    objectType: 'point', commandString: definitions[name] ?? '' })), 123);
  const problem = createDiscoveryProblem(graph);
  const add = (id: string, predicates: GeometryPredicate[]) => problem.candidates.push(candidate(id, predicates.map(
    (predicate) => mapPredicatePoints(predicate, (name) => `object:${name}`))));
  return { graph, problem, add };
};

export const vectorProblemA = () => {
  const result = make({ A: [1 / 3, 4 / 3], B: [-1, 0], C: [1, 0], M: [0, 0], H: [1 / 3, 2 / 3], D: [3 / 17, 12 / 17] },
    { M: '(B+C)/2', H: 'TriangleCenter(A,B,C,4)', D: '(H+Reflect(H,Line(A,M)))/2' });
  result.add('midpoint', [{ kind: 'midpoint', point: 'M', segment: ['B', 'C'] }]);
  result.add('altitudes', [{ kind: 'perpendicular', segments: [['A', 'H'], ['B', 'C']] },
    { kind: 'perpendicular', segments: [['B', 'H'], ['A', 'C']] }]);
  result.add('projection', [{ kind: 'collinear', points: ['A', 'M', 'D'] }, productPredicate('dot', [[1, ['H', 'D'], ['A', 'M']]])]);
  result.add('similar', [0, 1].map((i): GeometryPredicate => ({ kind: 'length-product', terms: [
    { segment: ['B', 'M'], coefficient: 1 }, { segment: ['A', 'M'], coefficient: -1 },
    { segment: i === 0 ? ['M', 'D'] : ['B', 'D'], coefficient: -1 },
    { segment: i === 0 ? ['M', 'B'] : ['A', 'B'], coefficient: 1 },
  ], constant: { numerator: 1, denominator: 1 } })));
  return { ...result, acceptedIds: ['midpoint', 'altitudes', 'projection'], goalId: 'similar' };
};

export const vectorProblemB = (x = 11 / 5, y = 3 / 5, k = 7 / 5) => {
  const ex = x - k * y; const ey = y + k * x - k; const delta = x * x + y * y - k * y;
  const result = make({ A: [1, 0], B: [0, 0], C: [0, k], D: [x, y], E: [ex, ey], F: [x / 2, y / 2],
    G: [ex / 2, (k + ey) / 2], H: [x * (x - k * y) / delta, x * (k * x - k + y) / delta] },
  { E: 'ToPoint((C-B)/(A-B)*(D-A)+D)', F: '(B+D)/2', G: '(C+E)/2', H: 'Intersect(Line(B,E),Line(C,D))' });
  result.add('right', [{ kind: 'perpendicular', segments: [['B', 'A'], ['B', 'C']] }]);
  result.add('inverse', [
    { kind: 'length-product', terms: [{ segment: ['A', 'B'], coefficient: 1 }, { segment: ['A', 'D'], coefficient: -1 },
      { segment: ['A', 'C'], coefficient: -1 }, { segment: ['A', 'E'], coefficient: 1 }], constant: { numerator: 1, denominator: 1 } },
    { kind: 'length-product', terms: [{ segment: ['A', 'B'], coefficient: 1 }, { segment: ['A', 'D'], coefficient: -1 },
      { segment: ['B', 'C'], coefficient: -1 }, { segment: ['D', 'E'], coefficient: 1 }], constant: { numerator: 1, denominator: 1 } },
    { kind: 'directed-angle-equation', terms: [{ angle: ['B', 'A', 'C'], coefficient: 1 },
      { angle: ['D', 'A', 'E'], coefficient: 1 }], pi: { numerator: 0, denominator: 1 } },
  ]);
  for (const operation of ['dot', 'cross'] as const) result.add(`inverse-${operation}`, [productPredicate(operation,
    [[1, ['A', 'B'], ['A', 'E']], [-1, ['A', 'C'], ['A', 'D']]])]);
  result.add('midpoints', [{ kind: 'midpoint', point: 'F', segment: ['B', 'D'] }, { kind: 'midpoint', point: 'G', segment: ['C', 'E'] }]);
  result.add('intersection', [{ kind: 'collinear', points: ['B', 'E', 'H'] }, { kind: 'collinear', points: ['C', 'D', 'H'] }]);
  result.add('goals', [{ kind: 'equal-length', segments: [['B', 'G'], ['D', 'G']] },
    { kind: 'parallel', segments: [['A', 'H'], ['F', 'G']] }, { kind: 'perpendicular', segments: [['F', 'G'], ['B', 'D']] }]);
  result.add('cross-goal', [productPredicate('cross', [[1, ['A', 'H'], ['F', 'G']]])]);
  result.add('feedback-goal', [productPredicate('dot', [[1, ['D', 'A'], ['D', 'E']]])]);
  result.add('false-goal', [{ kind: 'parallel', segments: [['A', 'B'], ['B', 'D']] }]);
  return { ...result, acceptedIds: ['right', 'inverse', 'midpoints', 'intersection'], goalId: 'goals' };
};

export const vectorSamplesB = (): SamplingResult => ({ seed: 4723,
  variedPointIds: ['A', 'B', 'C', 'D'].map((name) => `object:${name}`), diagnostics: [],
  samples: [[1.9, -0.4, 0.8], [-1.1, 2.3, 1.7], [0.3, 1.2, 1.1], [2.6, -1.1, 2.2], [-0.7, -0.9, 0.9], [1.3, 2.1, 1.9]].map(([x, y, k], index) => ({
    index, phase: index < 4 ? 'discovery' : 'holdout', coordinates: Object.fromEntries(vectorProblemB(x, y, k).problem.objects.map(
      (object) => [object.id, object.coordinates!])),
  })),
});

export const productTransferProblem = () => {
  const result = make({ A: [0, 0], B: [2, 0], C: [1, 3], D: [5, 7], E: [3, 7], F: [6, 10] }, {});
  result.add('lengths-and-angle', [{ kind: 'equal-length', segments: [['A', 'B'], ['D', 'E']] },
    { kind: 'equal-length', segments: [['A', 'C'], ['D', 'F']] },
    { kind: 'directed-angle-equation', terms: [{ angle: ['B', 'A', 'C'], coefficient: 1 },
      { angle: ['E', 'D', 'F'], coefficient: -1 }], pi: { numerator: 0, denominator: 1 } }]);
  result.add('signed-goals', (['dot', 'cross'] as const).map((operation) => productPredicate(operation,
    [[1, ['A', 'B'], ['A', 'C']], [1, ['D', 'E'], ['D', 'F']]])));
  result.add('wrong-sign', [productPredicate('dot', [[1, ['A', 'B'], ['A', 'C']], [-1, ['D', 'E'], ['D', 'F']]])]);
  result.add('zero-vector', [productPredicate('dot', [[1, ['A', 'A'], ['B', 'C']]])]);
  return result;
};
