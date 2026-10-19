import type { PointCoordinate } from '../../analysis/graphTypes';

export interface CoordinateSample {
  index: number;
  phase: 'discovery' | 'holdout';
  coordinates: Record<string, PointCoordinate | null>;
}
export interface SamplingResult {
  seed: number;
  samples: CoordinateSample[];
  variedPointIds: string[];
  diagnostics: string[];
}
