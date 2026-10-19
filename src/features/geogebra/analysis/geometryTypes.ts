import type { PointCoordinate } from './graphTypes';

import type { GeometryRelationKind } from './relations/catalog';
export type { GeometryRelationKind } from './relations/catalog';

export interface GeometryPoint {
  name: string;
  coordinates: PointCoordinate;
}

export interface GeometryTolerance {
  scale: number;
  distance: number;
  angular: number;
  lineOffset: number;
  circleCenter: number;
  circleRadius: number;
  minimumLength: number;
}

export interface RelationWitness {
  points: string[];
  segments?: Array<[string, string]>;
  lineFamilies?: string[][][];
  angles?: Array<[string, string, string]>;
  triangles?: Array<[string, string, string]>;
  triangleSymmetryOrder?: number;
  midpoint?: { point: string; segment: [string, string] };
  equation?: QuantityEquation;
}

export type GeometricQuantity = { kind: 'length'; points: [string, string] } | { kind: 'angle'; points: [string, string, string] };
/** An equation of geometric quantities, not a display string or construction AST. */
export interface QuantityEquation {
  terms: Array<{ coefficient: number; quantity: GeometricQuantity; equivalents?: GeometricQuantity[] }>;
  pi?: { numerator: number; denominator: number };
}

export interface LengthModel {
  anchor: [string, string];
  generators: Array<[string, string]>;
  members: Array<{ segment: [string, string]; coefficients: number[]; denominator: number; ratio: [number, number]; residual: number }>;
  constraintRank: number;
}

export interface DirectionModel {
  anchor: [string, string];
  generators: Array<[string, string]>;
  members: Array<{ line: [string, string]; coefficients: number[]; denominator: number; constant: number; residual: number }>;
  pointCover: string[];
  constraintRank: number;
}

export interface DependencySeparation {
  /** Bottleneck of the minimum spanning forest; null means disconnected. */
  constructionSpan: number | null;
  connectedComponents: number;
  /** Fraction of named objects with fully readable, acyclic upstream definitions. */
  dependencyCoverage: number;
  pointCount: number;
}

export interface GeometryRelation {
  id: string;
  kind: GeometryRelationKind;
  pointNames: string[];
  witnesses: RelationWitness[];
  confidence: number;
  nonTriviality: number;
  explanation: string;
  metric: DependencySeparation;
  model?: DirectionModel;
  lengthModel?: LengthModel;
  derived?: boolean;
  derivedFrom?: string[];
  baseNonTriviality?: number;
}

export interface GeometryRelationResult {
  relations: GeometryRelation[];
  pointCount: number;
  tolerance: GeometryTolerance;
  diagnostics: string[];
  computedAt: number;
}
