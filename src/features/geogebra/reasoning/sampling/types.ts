import type { PointCoordinate } from '../../analysis/graphTypes';

export interface CoordinateSample {
  index: number;
  phase: 'discovery' | 'holdout';
  coordinates: Record<string, PointCoordinate | null>;
}
export interface SamplingResult {
  /** False means the replica cannot validate this snapshot; samples are discarded. */
  baselineMatched?: boolean;
  seed: number;
  samples: CoordinateSample[];
  variedPointIds: string[];
  diagnostics: string[];
}

export const REPLICA_SNAPSHOT_WARNING = 'Replica did not reproduce the coordinate snapshot.';
