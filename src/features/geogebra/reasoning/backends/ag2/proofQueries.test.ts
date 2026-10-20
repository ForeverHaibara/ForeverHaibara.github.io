import { describe, expect, it } from 'vitest';
import { candidate, midpointProblem } from '../../__fixtures__/problems';
import { exportAg2Proof } from './exportProblem';
import { proofQueryCandidates } from './proofQueries';

describe('automatic proof queries', () => {
  it('preserves geometric diversity when angle candidates fill the original discovery order', () => {
    const problem = midpointProblem();
    const angles = Array.from({ length: 80 }, (_, i) => candidate(`angle-${i}`, [{ kind: 'directed-angle-equation',
      terms: [{ angle: ['b', 'a', 'c'], coefficient: i + 1 }], pi: { numerator: 0, denominator: 1 } }]));
    const circle = candidate('circle', [{ kind: 'concyclic', points: ['a', 'b', 'c', 'm'] }]);
    const queries = proofQueryCandidates([...angles, circle, ...problem.candidates], ['m-midpoint', 'n-midpoint']);
    expect(queries.slice(0, 5).map((entry) => entry.id)).toContain('circle');
    expect(queries.slice(0, 5).map((entry) => entry.id)).toContain('midsegment');
    expect(queries).toHaveLength(83);
  });

  it('skips repeated and already accepted equations without using observations as conditions', () => {
    const problem = midpointProblem();
    problem.candidates.unshift(candidate('repeat-midpoint', problem.candidates[0].predicates),
      candidate('repeat-parallel', problem.candidates[2].predicates));
    const result = exportAg2Proof(problem, { acceptedIds: ['m-midpoint', 'n-midpoint'], goalId: null }).value!;
    expect(result.acceptedIds).toEqual(['m-midpoint', 'n-midpoint']);
    expect(result.queries.filter((query) => query.goals.some((goal) => goal.startsWith('para')))).toHaveLength(1);
    expect(result.queries.some((query) => query.id === 'repeat-midpoint')).toBe(false);
    expect(result.premise).not.toContain('para');
    expect(result.operation).toBe('proof');
  });
});
