import { buildDependencyGraph } from '../../analysis/constructionGraph';
import type { PointCoordinate } from '../../analysis/graphTypes';
import type { GeometryPredicate, ReasoningProblem, Segment } from '../ir/types';
import type { SamplingResult } from '../sampling/types';
import { candidate } from './problems';

type Point = PointCoordinate;
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const sub = (a: Point, b: Point) => add(a, mul(b, -1));
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const foot = (x: Point, a: Point, b: Point) => add(a, mul(sub(b, a), dot(sub(x, a), sub(b, a)) / dot(sub(b, a), sub(b, a))));
const intersect = (a: Point, b: Point, c: Point, d: Point) => add(a, mul(sub(b, a), cross(sub(c, a), sub(d, c)) / cross(sub(b, a), sub(d, c))));
const coll = (...points: string[]): GeometryPredicate => ({ kind: 'collinear', points });
const equal = (a: Segment, b: Segment): GeometryPredicate => ({ kind: 'equal-length', segments: [a, b] });
const perp = (a: Segment, b: Segment): GeometryPredicate => ({ kind: 'perpendicular', segments: [a, b] });
const cyclic = (...points: string[]): GeometryPredicate => ({ kind: 'concyclic', points });

/** Test oracle only. Production code sees opaque commands, dependencies and samples. */
export const pedalFixture = (center: 'orthocenter' | 'incenter', variant = 0, extended = false) => {
  const triangles = [[{ x: 1, y: 4 }, { x: 0, y: 0 }, { x: 6, y: 0 }],
    [{ x: -2, y: 3 }, { x: 0, y: 0 }, { x: 7, y: 0 }],
    [{ x: 2, y: -5 }, { x: 0, y: 0 }, { x: 8, y: 0 }],
    [{ x: 3, y: 6 }, { x: 0, y: 0 }, { x: 9, y: 0 }],
    [{ x: -3, y: -4 }, { x: 0, y: 0 }, { x: 5, y: 0 }],
    [{ x: 2.5, y: 3.5 }, { x: 0, y: 0 }, { x: 7.5, y: 0 }],
    [{ x: 5, y: -3 }, { x: 0, y: 0 }, { x: 6.5, y: 0 }]];
  const [a, b, c] = triangles[variant % triangles.length];
  const o = { x: c.x / 2, y: (dot(a, a) - c.x * a.x) / (2 * a.y) };
  const h = sub(add(add(a, b), c), mul(o, 2));
  const sides = [length(b, c), length(c, a), length(a, b)];
  const i = mul(add(add(mul(a, sides[0]), mul(b, sides[1])), mul(c, sides[2])), 1 / sides.reduce((sum, side) => sum + side, 0));
  const x = center === 'orthocenter' ? h : i;
  const d = foot(x, b, c); const e = foot(x, c, a); const f = foot(x, a, b);
  const coordinates: Record<string, Point> = { A: a, B: b, C: c, X: x, D: d, E: e, F: f };
  const definitions: Record<string, string> = { X: `TriangleCenter(A,B,C,${center === 'orthocenter' ? 4 : 1})`,
    D: 'unknown(X,B,C)', E: 'unknown(X,C,A)', F: 'unknown(X,A,B)' };
  const conditions: Array<[string, GeometryPredicate[]]> = [
    ...(['D', 'E', 'F'] as const).map((p, j): [string, GeometryPredicate[]] => {
      const side: Segment = [['B', 'C'], ['C', 'A'], ['A', 'B']][j] as Segment;
      return [`foot-${p}`, [coll(p, ...side), perp(['X', p], side)]];
    }),
    ['center', center === 'orthocenter' ? [perp(['A', 'X'], ['B', 'C']), perp(['B', 'X'], ['A', 'C'])]
      : ['A', 'B'].map((v, j): GeometryPredicate => ({ kind: 'directed-angle-equation', terms: [
        { angle: [['B', 'C'][j], v, 'X'], coefficient: 1 },
        { angle: ['X', v, ['C', 'A'][j]], coefficient: -1 },
      ], pi: { numerator: 0, denominator: 1 } }))],
  ];
  const targets: Array<[string, GeometryPredicate[]]> = [
    ['pedal-A', [cyclic('A', 'E', 'X', 'F')]], ['pedal-B', [cyclic('B', 'F', 'X', 'D')]], ['pedal-C', [cyclic('C', 'D', 'X', 'E')]],
    ...(center === 'orthocenter' ? [['orthic-BC', [cyclic('B', 'C', 'E', 'F')]], ['orthic-CA', [cyclic('C', 'A', 'F', 'D')]]] as Array<[string, GeometryPredicate[]]>
      : [['tangent-A', [equal(['A', 'E'], ['A', 'F'])]], ['tangent-B', [equal(['B', 'D'], ['B', 'F'])]],
        ['inradius', [equal(['X', 'D'], ['X', 'E']), equal(['X', 'E'], ['X', 'F'])]], ['contact-chord', [perp(['A', 'X'], ['E', 'F'])]]] as Array<[string, GeometryPredicate[]]>),
  ];
  if (extended) {
    const u = sub(mul(o, 2), a); const v = sub(x, u);
    const p = add(u, mul(v, -2 * dot(sub(u, o), v) / dot(v, v)));
    Object.assign(coordinates, { O: o, U: u, P: p, R: intersect(a, p, b, c), M: mul(add(b, c), 0.5) });
    Object.assign(definitions, { O: 'unknown(A,B,C)', U: 'unknown(A,O)', P: 'unknown(A,B,C,U,X)', R: 'unknown(A,P,B,C)', M: 'unknown(B,C)' });
    conditions.push(['circumcenter', [equal(['O', 'A'], ['O', 'B']), equal(['O', 'A'], ['O', 'C'])]],
      ['antipode', [{ kind: 'midpoint', point: 'O', segment: ['A', 'U'] }]],
      ['second-intersection', [cyclic('A', 'B', 'C', 'P'), coll('U', 'X', 'P')]],
      ['intersection-R', [coll('A', 'P', 'R'), coll('B', 'C', 'R')]],
      ['midpoint-M', [{ kind: 'midpoint', point: 'M', segment: ['B', 'C'] }]]);
    targets.push(['diameter-angle', [perp(['A', 'P'], ['U', 'X'])]], ['R-perpendicular', [perp(['A', 'R'], ['U', 'X'])]]);
    if (center === 'orthocenter') targets.push(['antipode-midpoint', [{ kind: 'midpoint', point: 'M', segment: ['X', 'U'] }]],
      ['nine-point', [cyclic('D', 'E', 'F', 'M')]], ['R-Euler', [perp(['A', 'R'], ['X', 'M'])]]);
    else {
      const w = add(a, mul(sub(i, a), -2 * dot(sub(a, o), sub(i, a)) / dot(sub(i, a), sub(i, a))));
      Object.assign(coordinates, { W: w, S: intersect(b, i, e, f), T: foot(a, b, i) });
      Object.assign(definitions, { W: 'unknown(A,X,B,C)', S: 'unknown(B,X,E,F)', T: 'unknown(A,B,X)' });
      conditions.push(['arc-intersection', [cyclic('A', 'B', 'C', 'W'), coll('A', 'X', 'W')]],
        ['intersection-S', [coll('B', 'X', 'S'), coll('E', 'F', 'S')]], ['projection-T', [coll('B', 'X', 'T'), perp(['A', 'T'], ['B', 'X'])]]);
      targets.push(['arc-midpoint', [equal(['W', 'B'], ['W', 'C'])]], ['arc-incenter', [equal(['W', 'X'], ['W', 'B'])]],
        ['contact-polar', [{ kind: 'length-product', terms: [{ segment: ['X', 'S'], coefficient: 1 },
          { segment: ['X', 'T'], coefficient: 1 }, { segment: ['X', 'E'], coefficient: -2 }], constant: { numerator: 1, denominator: 1 } }]]);
    }
  }
  const graph = buildDependencyGraph(Object.entries(coordinates).map(([name, point]) => ({ name, objectType: 'point', coordinates: point,
    commandString: definitions[name] ?? '' })), 123);
  // Keep the fixture's readable symbols; the production exporter remaps them safely.
  const problem: ReasoningProblem = { version: 1, snapshot: 123, diagnostics: [], objects: graph.nodes.map((node) => ({
    id: node.name, name: node.name, objectType: node.objectType, coordinates: node.coordinates,
    definition: definitions[node.name] ?? null, dependencies: node.parsed?.dependencies ?? [], dependencyStatus: node.dependencyStatus,
  })), candidates: [...conditions, ...targets].map(([id, predicates]) => candidate(id, predicates)) };
  return { graph, problem, acceptedIds: conditions.map(([id]) => id), targets: targets.map(([id]) => id) };
};

export const pedalSamples = (center: 'orthocenter' | 'incenter'): SamplingResult => ({ seed: 7139,
  variedPointIds: ['A', 'B', 'C'].map((name) => `object:${name}`), diagnostics: [], samples: Array.from({ length: 6 }, (_, index) => ({
    index, phase: index < 4 ? 'discovery' as const : 'holdout' as const,
    coordinates: Object.fromEntries(pedalFixture(center, index + 1).graph.nodes.map((node) => [node.id, node.coordinates!])),
  })) });
