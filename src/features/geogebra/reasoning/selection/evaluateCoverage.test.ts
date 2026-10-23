import { describe, expect, it, vi } from 'vitest';
import { midpointProblem } from '../__fixtures__/problems';
import { evaluateCoverage } from './evaluateCoverage';
import { reasoningPreset } from '../preferences/reasoningPreferences';
import type { Ag2WorkerClient } from '../backends/ag2/Ag2WorkerClient';
import type { Ag2Export } from '../backends/ag2/exportProblem';
import type { CharacterizationProposal } from './types';

describe('coverage computation budget', () => {
  it('limits candidate queries and uses the same settings for the worker run', async () => {
    const proposal: CharacterizationProposal = { version: 1, problem: midpointProblem(), objects: [], coreIds: ['m-midpoint'], diagnostics: [] };
    const run = vi.fn(async (value: Ag2Export) => ({ checks: value.goals.map(() => true), elapsedMs: 1 }));
    const settings = { ...reasoningPreset(), maxCoverageQueries: 1, solvingSeconds: 5 };
    const result = await evaluateCoverage(proposal, { run } as unknown as Ag2WorkerClient, () => undefined, settings);
    expect(result.checkedIds).toHaveLength(1); expect(result.coveredIds).toEqual(result.checkedIds);
    expect(result.diagnostics.join(' ')).toContain('budgets');
    expect(run.mock.calls[0]).toHaveLength(3);
    expect((run.mock.calls[0] as unknown[])[2]).toEqual(settings);
  });
});
