import type { PointCoordinate } from './graphTypes';

export type GeometryRelationKind = 'parallel' | 'perpendicular' | 'collinear' | 'concyclic';

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
}

export interface DependencySeparation {
  branchDiversity: number;
  depthFactor: number;
  independenceFactor: number;
  meanDepth: number;
  sharedAncestorWeight: number;
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
}

export interface GeometryRelationResult {
  relations: GeometryRelation[];
  pointCount: number;
  tolerance: GeometryTolerance;
  diagnostics: string[];
  computedAt: number;
}
