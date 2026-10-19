import type { GeometryRelationKind, RelationWitness, DirectionModel, LengthModel } from '../geometryTypes';

export interface RelationSeed {
  key: string;
  kind: GeometryRelationKind;
  witness: RelationWitness;
  points: Set<number>;
  confidence: number;
  scoringNames?: string[];
  expandAliases?: boolean;
  model?: DirectionModel;
  lengthModel?: LengthModel;
  derived?: boolean;
  sourceIds?: string[];
}
