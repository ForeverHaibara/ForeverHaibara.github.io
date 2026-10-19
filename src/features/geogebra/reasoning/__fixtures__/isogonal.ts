import { buildDependencyGraph } from '../../analysis/constructionGraph';
import type { PointCoordinate } from '../../analysis/graphTypes';
import type { GeometryPredicate } from '../ir/types';
import type { SamplingResult } from '../sampling/types';

// Test oracle only: the production search receives coordinates and opaque dependencies.
const conjugate = ([a, b, c]: PointCoordinate[], p: PointCoordinate): PointCoordinate => {
  const area = (u: PointCoordinate, v: PointCoordinate, w: PointCoordinate) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  const total = area(a, b, c); const bary = [area(p, b, c), area(a, p, c), area(a, b, p)].map((value) => value / total);
  const vertices = [a, b, c];
  const weights = vertices.map((_, i) => { const u = vertices[(i + 1) % 3]; const v = vertices[(i + 2) % 3]; return ((u.x - v.x) ** 2 + (u.y - v.y) ** 2) / bary[i]; });
  const sum = weights.reduce((value, weight) => value + weight, 0);
  return { x: weights.reduce((value, weight, i) => value + weight * vertices[i].x, 0) / sum,
    y: weights.reduce((value, weight, i) => value + weight * vertices[i].y, 0) / sum };
};
export const isogonalConstruction = (p = { x: 2, y: 1 }, variant = 0) => {
  const triangle = [{ x: 0, y: 0 }, { x: 6 + variant * 0.3, y: variant * 0.1 }, { x: 2 - variant * 0.2, y: 4 + variant * 0.1 }];
  const q = conjugate(triangle, p);
  const points = [...triangle, p, q].map((point) => variant % 2 ? { x: -point.x, y: point.y } : point);
  return buildDependencyGraph(points.map((coordinates, i) => ({ name: ['A', 'B', 'C', 'P', 'Q'][i], objectType: 'point', coordinates,
    commandString: i === 4 ? 'unknown(A,B,C,P)' : '' })), 123);
};
export const isogonalPredicates = (): GeometryPredicate[] => ['A', 'B', 'C'].map((vertex, i, names) => ({
  kind: 'directed-angle-equation', pi: { numerator: 0, denominator: 1 }, terms: [
    { angle: [names[(i + 1) % 3], vertex, 'P'].map((name) => `object:${name}`) as [string, string, string], coefficient: 1 },
    { angle: ['Q', vertex, names[(i + 2) % 3]].map((name) => `object:${name}`) as [string, string, string], coefficient: -1 },
  ],
}));
export const isogonalSamples = (): SamplingResult => ({ seed: 294731, variedPointIds: ['A', 'B', 'C', 'P'].map((name) => `object:${name}`), diagnostics: [],
  samples: [{ x: -2, y: 1 }, { x: 3, y: -2 }, { x: 7, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 3 }, { x: 4, y: 1 }].map((point, index) => ({
    index, phase: index < 4 ? 'discovery' : 'holdout',
    coordinates: Object.fromEntries(isogonalConstruction(point, index).nodes.filter((node) => node.coordinates).map((node) => [node.id, node.coordinates!])),
  })) });
