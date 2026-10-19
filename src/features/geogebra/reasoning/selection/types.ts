import type { ReasoningProblem } from '../ir/types';
import type { SamplingResult } from '../sampling/types';

export interface CharacterizationOptions {
  maxObjects: number;
  maxScopePoints: number;
  maxCandidatesPerObject: number;
  maxConditions: number;
  allowEarlierContext: boolean;
}
export const DEFAULT_CHARACTERIZATION_OPTIONS: CharacterizationOptions = {
  maxObjects: 16, maxScopePoints: 10, maxCandidatesPerObject: 80,
  maxConditions: 24, allowEarlierContext: true,
};
export interface ObjectCharacterization {
  objectId: string;
  scopeIds: string[];
  contextIds: string[];
  candidateIds: string[];
  coreIds: string[];
  rank: number;
  conditioning: number | null;
  status: 'free' | 'isolated-locally' | 'partial' | 'unavailable';
  reasons: Array<{ candidateId: string; rankGain: number; cost: number }>;
  rejectedCandidates: number;
  counterexamples: Array<{ label: string; index: number; phase: 'discovery' | 'holdout'; residual: number }>;
  diagnostics: string[];
}
export interface CharacterizationProposal {
  version: 1;
  problem: ReasoningProblem;
  objects: ObjectCharacterization[];
  coreIds: string[];
  diagnostics: string[];
  sampling?: SamplingResult;
}
export interface CoverageResult {
  coveredIds: string[];
  uncoveredIds: string[];
  checkedIds: string[];
  diagnostics: string[];
  elapsedMs: number;
}
