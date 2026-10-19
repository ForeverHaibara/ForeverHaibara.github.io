import { proposeConditions } from './proposeConditions';
import type { DependencyGraph } from '../../analysis/graphTypes';
import type { CharacterizationOptions, CharacterizationProposal } from './types';
import type { SamplingResult } from '../sampling/types';

export interface CharacterizationRequest { graph: DependencyGraph; options: CharacterizationOptions; sampling?: SamplingResult; }
export type CharacterizationResponse = { proposal: CharacterizationProposal; error?: never } | { error: string; proposal?: never };
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<CharacterizationRequest>) => void) | null; postMessage(response: CharacterizationResponse): void };
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ proposal: proposeConditions(data.graph, data.options, data.sampling) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Local condition search failed.' }); }
};
