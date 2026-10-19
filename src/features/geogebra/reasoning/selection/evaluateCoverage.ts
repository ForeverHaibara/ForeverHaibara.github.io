import { exportAg2Queries } from '../backends/ag2/exportProblem';
import type { Ag2WorkerClient } from '../backends/ag2/Ag2WorkerClient';
import type { CharacterizationProposal, CoverageResult } from './types';

export const evaluateCoverage = async (proposal: CharacterizationProposal, client: Ag2WorkerClient,
  onPhase: (phase: 'loading' | 'solving') => void): Promise<CoverageResult> => {
  const queryIds: string[] = []; let skipped = 0; let ordinary = 0;
  for (const candidate of proposal.problem.candidates) {
    if (proposal.coreIds.includes(candidate.id) || candidate.diagnostics.length) continue;
    if (candidate.predicates.some((predicate) => predicate.kind === 'ordinary-angle-equation')) { ordinary += 1; continue; }
    if (queryIds.length >= 64) { skipped += 1; continue; }
    const result = exportAg2Queries(proposal.problem, proposal.coreIds, [...queryIds, candidate.id]);
    if (result.value) queryIds.push(candidate.id); else skipped += 1;
  }
  const diagnostics = skipped ? [`${skipped} candidate queries were outside export or evaluation budgets.`] : [];
  if (ordinary) diagnostics.push(`${ordinary} ordinary-angle queries require a ray/inequality proof and were excluded from modular DDAR coverage.`);
  if (!queryIds.length) return { coveredIds: [], uncoveredIds: [], checkedIds: [], diagnostics, elapsedMs: 0 };
  const value = exportAg2Queries(proposal.problem, proposal.coreIds, queryIds).value!;
  const result = await client.run(value, onPhase);
  const coveredIds = value.queries.filter((query) => query.goals.every((goal) => result.checks[value.goals.indexOf(goal)])).map((query) => query.id);
  return { coveredIds, uncoveredIds: queryIds.filter((id) => !coveredIds.includes(id)), checkedIds: queryIds, diagnostics, elapsedMs: result.elapsedMs };
};
