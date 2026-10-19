import type { PointCoordinate } from '../../analysis/graphTypes';

export type Segment = [string, string];
export type Angle = [string, string, string];
export interface Rational { numerator: number; denominator: number; }
export interface SegmentTerm { segment: Segment; coefficient: number; }

/** Semantic predicates; no GeoGebra expression or backend text is executable here. */
export type GeometryPredicate =
  | { kind: 'collinear' | 'concyclic'; points: string[] }
  | { kind: 'coincident'; points: Segment }
  | { kind: 'parallel' | 'perpendicular' | 'equal-length'; segments: [Segment, Segment] }
  | { kind: 'midpoint'; point: string; segment: Segment }
  | { kind: 'ordinary-angle-equation'; terms: Array<{ angle: Angle; coefficient: number }>; pi: Rational }
  | { kind: 'direction-equation' | 'length-sum'; terms: SegmentTerm[]; constant: Rational }
  | { kind: 'length-product'; terms: SegmentTerm[]; constant: Rational };

export interface ReasoningObject {
  id: string;
  name: string;
  objectType: string | null;
  definition: string | null;
  dependencies: string[];
  dependencyStatus: 'free' | 'parsed' | 'partial' | 'unavailable';
  coordinates?: PointCoordinate;
}

export interface ConditionCandidate {
  id: string;
  label: string;
  predicates: GeometryPredicate[];
  source: { kind: 'numerical-observation'; relationId: string; snapshot: number; derivedFrom: string[] };
  evidence: { kind: 'single-snapshot'; };
  diagnostics: string[];
}

export interface ReasoningProblem {
  version: 1;
  snapshot: number;
  objects: ReasoningObject[];
  candidates: ConditionCandidate[];
  diagnostics: string[];
}

export interface ConditionSelection {
  acceptedIds: string[];
  goalId: string | null;
}

export const predicatePoints = (predicate: GeometryPredicate): string[] => {
  if ('points' in predicate) return predicate.points;
  if ('segments' in predicate) return predicate.segments.flat();
  if (predicate.kind === 'midpoint') return [predicate.point, ...predicate.segment];
  if (predicate.kind === 'ordinary-angle-equation') return predicate.terms.flatMap((term) => term.angle);
  return predicate.terms.flatMap((term) => term.segment);
};

export const mapPredicatePoints = (predicate: GeometryPredicate, map: (point: string) => string): GeometryPredicate => {
  const segment = (points: Segment): Segment => [map(points[0]), map(points[1])];
  if (predicate.kind === 'collinear' || predicate.kind === 'concyclic') return { ...predicate, points: predicate.points.map(map) };
  if (predicate.kind === 'coincident') return { ...predicate, points: segment(predicate.points) };
  if ('segments' in predicate) return { ...predicate, segments: [segment(predicate.segments[0]), segment(predicate.segments[1])] };
  if (predicate.kind === 'midpoint') return { ...predicate, point: map(predicate.point), segment: segment(predicate.segment) };
  if (predicate.kind === 'ordinary-angle-equation') return { ...predicate, terms: predicate.terms.map((term) => ({ ...term, angle: term.angle.map(map) as Angle })) };
  if ('terms' in predicate) return { ...predicate, terms: predicate.terms.map((term) => ({ ...term, segment: segment(term.segment) })) };
  return predicate;
};
