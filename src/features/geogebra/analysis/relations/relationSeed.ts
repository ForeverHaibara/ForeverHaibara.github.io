import type { GeometryRelationKind, RelationWitness, DirectionModel, LengthModel, RelationSupport, RelationFamily } from '../geometryTypes';

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
  support?: RelationSupport;
  /** Score distinct new conditions separately; witness unions must not add value. */
  scoringGroups?: string[][];
  family?: RelationFamily;
}
