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
