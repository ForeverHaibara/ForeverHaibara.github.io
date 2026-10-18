import type { GeometryRelationKind, RelationWitness, DirectionModel } from '../geometryTypes';

export interface RelationSeed {
  key: string;
  kind: GeometryRelationKind;
  witness: RelationWitness;
  points: Set<number>;
  confidence: number;
  scoringNames?: string[];
  expandAliases?: boolean;
  model?: DirectionModel;
  derived?: boolean;
  sourceIds?: string[];
}
