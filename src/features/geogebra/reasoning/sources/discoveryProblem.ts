import type { DependencyGraph } from '../../analysis/graphTypes';
import type { GeometryRelation, GeometryRelationResult, QuantityEquation, RelationWitness } from '../../analysis/geometryTypes';
import { formatRelation } from '../../analysis/presentation/formatRelation';
import { mapPredicatePoints, predicatePoints } from '../ir/types';
import type { GeometryPredicate, ReasoningProblem, Segment } from '../ir/types';

const zero = { numerator: 0, denominator: 1 };
const equalLengths = (a: Segment, b: Segment): GeometryPredicate => ({ kind: 'equal-length', segments: [a, b] });

const fromEquation = (equation: QuantityEquation): GeometryPredicate[] => {
  if (equation.terms.length === 0) return [];
  const predicates: GeometryPredicate[] = [];
  if (equation.terms.every((term) => term.quantity.kind === 'length')) {
    if (equation.pi?.numerator) return [];
    predicates.push({ kind: 'length-sum', terms: equation.terms.map((term) => ({
      segment: term.quantity.points as Segment, coefficient: term.coefficient,
    })), constant: zero });
  } else if (equation.terms.every((term) => term.quantity.kind === 'angle')) {
    predicates.push({ kind: 'ordinary-angle-equation', terms: equation.terms.map((term) => ({
      angle: term.quantity.points as [string, string, string], coefficient: term.coefficient,
    })), pi: equation.pi ?? zero });
  } else return [];
  // Equal-value classes contribute a star, never an untested Cartesian family.
  for (const term of equation.terms) for (const other of term.equivalents ?? []) {
    if (other.kind !== term.quantity.kind) return [];
    if (JSON.stringify(other) === JSON.stringify(term.quantity)) continue;
    predicates.push(other.kind === 'length' ? equalLengths(term.quantity.points as Segment, other.points)
      : { kind: 'ordinary-angle-equation', terms: [{ angle: term.quantity.points as [string, string, string], coefficient: 1 },
        { angle: other.points, coefficient: -1 }], pi: zero });
  }
  return predicates;
};

type LinePair = (names: string[]) => Segment;
const fromWitness = (kind: GeometryRelation['kind'], witness: RelationWitness, linePair: LinePair): GeometryPredicate[] => {
  if (witness.midpoint) return [{ kind: 'midpoint', ...witness.midpoint }];
  if (witness.equation) return fromEquation(witness.equation);
  if (kind === 'collinear') return [{ kind, points: witness.lineFamilies?.[0]?.[0] ?? witness.points }];
  if (kind === 'concyclic') return [{ kind, points: witness.points }];
  if (kind === 'coincident-points') return witness.points.slice(1).map((point) => ({ kind: 'coincident', points: [witness.points[0], point] }));
  if (kind === 'parallel') {
    const lines = witness.lineFamilies?.[0] ?? [];
    return [...lines.filter((line) => line.length > 2).map((line): GeometryPredicate => ({ kind: 'collinear', points: line })),
      ...lines.slice(1).map((line): GeometryPredicate => ({ kind, segments: [linePair(lines[0]), linePair(line)] }))];
  }
  if (kind === 'perpendicular') {
    const [left, right] = witness.lineFamilies ?? [];
    if (!left?.length || !right?.length) return [];
    const a = linePair(left[0]); const b = linePair(right[0]);
    return [...[...left, ...right].filter((line) => line.length > 2).map((line): GeometryPredicate => ({ kind: 'collinear', points: line })),
      { kind, segments: [a, b] }, ...left.slice(1).map((line): GeometryPredicate => ({ kind: 'parallel', segments: [a, linePair(line)] })),
      ...right.slice(1).map((line): GeometryPredicate => ({ kind: 'parallel', segments: [b, linePair(line)] }))];
  }
  if (witness.segments) return witness.segments.slice(1).map((segment) => equalLengths(witness.segments![0], segment));
  if (witness.angles) return witness.angles.slice(1).map((angle) => ({ kind: 'ordinary-angle-equation', terms: [
    { angle: witness.angles![0], coefficient: 1 }, { angle, coefficient: -1 },
  ], pi: zero }));
  if (witness.triangles) {
    const edges = ([a, b, c]: [string, string, string]): Segment[] => [[a, b], [b, c], [c, a]];
    const base = edges(witness.triangles[0]);
    return witness.triangles.slice(1).flatMap((triangle) => {
      const other = edges(triangle);
      return kind === 'congruent-triangles' ? base.map((segment, i) => equalLengths(segment, other[i]))
        : [0, 1].map((i): GeometryPredicate => ({ kind: 'length-product', terms: [
          { segment: base[i], coefficient: 1 }, { segment: other[i], coefficient: -1 },
          { segment: base[2], coefficient: -1 }, { segment: other[2], coefficient: 1 },
        ], constant: { numerator: 1, denominator: 1 } }));
    });
  }
  return [];
};

const fromRelation = (relation: GeometryRelation, linePair: LinePair): GeometryPredicate[] => {
  if (relation.model) {
    const model = relation.model;
    return model.members.map((member) => ({ kind: 'direction-equation', terms: [
      { segment: member.line, coefficient: member.denominator },
      ...model.generators.map((segment, i) => ({ segment, coefficient: -member.coefficients[i] })),
      { segment: model.anchor, coefficient: member.coefficients.reduce((sum, value) => sum + value, 0) - member.denominator },
    ], constant: { numerator: member.constant, denominator: 1 } }));
  }
  if (relation.lengthModel) {
    const model = relation.lengthModel;
    return model.members.map((member) => ({ kind: 'length-product', terms: [
      { segment: member.segment, coefficient: member.denominator },
      ...model.generators.map((segment, i) => ({ segment, coefficient: -member.coefficients[i] })),
      { segment: model.anchor, coefficient: member.coefficients.reduce((sum, value) => sum + value, 0) - member.denominator },
    ], constant: { numerator: member.ratio[0], denominator: member.ratio[1] } }));
  }
  const witnesses = relation.family ? relation.family.instances.map((instance) => instance.witness) : relation.witnesses;
  return witnesses.flatMap((witness) => fromWitness(relation.kind, witness, linePair));
};

/** Observe opaque outputs. Command text is provenance, never a semantic oracle. */
export const createDiscoveryProblem = (graph: DependencyGraph, result: GeometryRelationResult | null = null): ReasoningProblem => {
  const objects = graph.nodes.filter((node) => !node.isSentinel).map((node) => ({
    id: node.id, name: node.name, objectType: node.objectType, definition: node.commandString,
    dependencies: graph.edges.filter((edge) => edge.kind === 'dependency' && edge.target === node.id).map((edge) => edge.source),
    dependencyStatus: node.dependencyStatus, coordinates: node.coordinates && { ...node.coordinates },
  }));
  const byName = new Map(objects.map((object) => [object.name, object.id]));
  const coordinates = new Map(objects.map((object) => [object.name, object.coordinates]));
  const linePair: LinePair = (names) => {
    let pair = names.slice(0, 2) as Segment; let largest = -1;
    for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) {
      const a = coordinates.get(names[i]); const b = coordinates.get(names[j]);
      const distance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : -1;
      if (distance > largest) { largest = distance; pair = [names[i], names[j]]; }
    }
    return pair;
  };
  const finitePoints = new Set(objects.filter((object) => object.coordinates && Number.isFinite(object.coordinates.x) && Number.isFinite(object.coordinates.y)).map((object) => object.id));
  return { version: 1, snapshot: graph.generatedAt, objects,
    diagnostics: result ? ['Candidates are retained single-snapshot observations, not an exhaustive property description.', ...result.diagnostics,
      ...(result.computedAt === graph.generatedAt ? [] : ['Discovery belongs to another construction snapshot.'])] : [],
    candidates: (result?.relations ?? []).map((relation) => {
      const diagnostics: string[] = [];
      const predicates = fromRelation(relation, linePair).map((predicate) => mapPredicatePoints(predicate, (name) => byName.get(name) ?? name));
      if (!predicates.length) diagnostics.push('This observation has no supported predicate representation.');
      if (predicates.some((predicate) => predicatePoints(predicate).some((point) => !finitePoints.has(point)))) diagnostics.push('Some witness points have no finite two-dimensional coordinates.');
      return { id: relation.id, label: formatRelation(relation), predicates: diagnostics.length ? [] : predicates,
        source: { kind: 'numerical-observation', relationId: relation.id, snapshot: result!.computedAt, derivedFrom: relation.derivedFrom ?? [] },
        evidence: { kind: 'single-snapshot' }, diagnostics };
    }) };
};
