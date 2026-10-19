import { describe, expect, it } from 'vitest';
import { midpointProblem } from '../__fixtures__/problems';
import { assessLocalConstraint, constraintRank } from './localConstraints';
import { createSamplePlan } from '../sampling/samplePlan';

describe('local geometric constraint rank', () => {
  it('distinguishes repeated conditions from transverse constraints', () => {
    const problem = midpointProblem();
    const incidence = assessLocalConstraint({ kind: 'collinear', points: ['a', 'm', 'b'] }, 'm', problem.objects)!;
    const bisector = assessLocalConstraint({ kind: 'equal-length', segments: [['a', 'm'], ['m', 'b']] }, 'm', problem.objects)!;
    expect(constraintRank([...incidence.gradients, ...incidence.gradients]).rank).toBe(1);
    expect(constraintRank([...incidence.gradients, ...bisector.gradients]).rank).toBe(2);
    expect(constraintRank([[1, 0], [1, 1e-5]]).rank).toBe(1);
  });

  it('reports contradictory observations without converting them into rank evidence', () => {
    const problem = midpointProblem();
    problem.objects[3].coordinates!.y = 1;
    const predicate = { kind: 'collinear' as const, points: ['a', 'm', 'b'] };
    expect(assessLocalConstraint(predicate, 'm', problem.objects)).toBeNull();
    expect(assessLocalConstraint(predicate, 'm', problem.objects, false)!.residual).toBeGreaterThan(0.1);
  });

  it('uses reproducible free-point variations and separates the held-out set', () => {
    const points = midpointProblem().objects.slice(0, 3);
    expect(createSamplePlan(points, 3)).toEqual(createSamplePlan(points, 3));
    expect(createSamplePlan(points, 3)).not.toEqual(createSamplePlan(points, 4));
    expect(createSamplePlan(points).map((step) => step.phase)).toEqual(['discovery', 'discovery', 'discovery', 'discovery', 'holdout', 'holdout']);
  });
});
