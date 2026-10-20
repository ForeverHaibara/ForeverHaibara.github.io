import { describe, expect, it } from 'vitest';
import { canonicalDirectionEquation } from '../../analysis/quantities/directedAngles';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS } from '../../analysis/relations/catalog';
import { isogonalConstruction, isogonalPredicates, isogonalSamples } from '../__fixtures__/isogonal';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import { assessLocalConstraint, constraintRank } from './localConstraints';
import { proposeConditions } from './proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from './types';
import type { GeometryPredicate } from '../ir/types';

const key = (predicate: GeometryPredicate) => predicate.kind === 'directed-angle-equation' ? canonicalDirectionEquation(predicate.terms, predicate.pi).key : null;

describe('directed black-box characterizations', () => {
  it('independently discovers the three isogonal equations without recognizing the command', () => {
    const graph = isogonalConstruction();
    const result = detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['directed-angles'], compressConsequences: false });
    const problem = createDiscoveryProblem(graph, result);
    const observed = new Set(problem.candidates.flatMap((candidate) => candidate.predicates.map(key)));
    for (const predicate of isogonalPredicates()) expect(observed.has(key(predicate))).toBe(true);
    expect(problem.candidates.every((candidate) => candidate.label.includes('∡') && candidate.label.includes('mod π'))).toBe(true);
  });

  it('keeps isogonal conditions across interior/exterior, mirrored and reshaped samples', () => {
    const graph = isogonalConstruction(); const sampling = isogonalSamples();
    const proposal = proposeConditions(graph, DEFAULT_CHARACTERIZATION_OPTIONS, sampling);
    const report = proposal.objects.find((object) => object.objectId === 'object:Q')!;
    expect(report.rank).toBe(2); expect(report.coreIds).toHaveLength(2);
    expect(report.coreIds.every((id) => proposal.problem.candidates.find((candidate) => candidate.id === id)?.predicates[0].kind === 'directed-angle-equation')).toBe(true);
    for (const predicate of isogonalPredicates()) {
      const candidate = proposal.problem.candidates.find((candidate) => key(candidate.predicates[0]) === key(predicate));
      expect(candidate?.diagnostics).toEqual([]);
      expect(candidate?.evidence).toMatchObject({ kind: 'sampled', discoverySamples: 4, holdoutSamples: 2 });
    }
    expect(proposal.problem.candidates.some((candidate) => candidate.predicates.some((predicate) => predicate.kind === 'ordinary-angle-equation'))).toBe(false);
  });

  it('rejects an ordinary interpretation when only the directed isogonal equation survives', () => {
    const graph = isogonalConstruction({ x: -2, y: 1 }); const problem = createDiscoveryProblem(graph);
    const directed = isogonalPredicates()[0];
    if (!('pi' in directed)) throw new Error('Expected angular test condition');
    expect(assessLocalConstraint(directed, 'object:Q', problem.objects, false)!.residual).toBeLessThan(1e-12);
    expect(assessLocalConstraint({ ...directed, kind: 'ordinary-angle-equation' }, 'object:Q', problem.objects, false)!.residual).toBeGreaterThan(0.1);
  });

  it('retains real directed counterexamples instead of exempting a named construction', () => {
    const sampling = isogonalSamples(); sampling.samples[0].coordinates['object:Q']!.x += 0.5;
    const proposal = proposeConditions(isogonalConstruction(), DEFAULT_CHARACTERIZATION_OPTIONS, sampling);
    const expected = new Set(isogonalPredicates().map(key));
    expect(proposal.coreIds.some((id) => expected.has(key(proposal.problem.candidates.find((candidate) => candidate.id === id)!.predicates[0])))).toBe(false);
    const rejected = proposal.problem.candidates.filter((candidate) => expected.has(key(candidate.predicates[0])));
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected.every((candidate) => candidate.hypothesisEligible && candidate.diagnostics.length)).toBe(true);
    expect(proposal.objects.find((object) => object.objectId === 'object:Q')!.counterexamples.length).toBeGreaterThan(0);
  });

  it('differentiates the local lift at a flat angle across the atan2 cut', () => {
    const problem = createDiscoveryProblem(isogonalConstruction());
    problem.objects.find((object) => object.name === 'P')!.coordinates = { x: -1, y: 0 };
    const assessment = assessLocalConstraint({ kind: 'directed-angle-equation', terms: [{ angle: ['object:B', 'object:A', 'object:P'], coefficient: 1 }], pi: { numerator: 0, denominator: 1 } }, 'object:P', problem.objects)!;
    expect(assessment.residual).toBeLessThan(1e-12);
    expect(constraintRank(assessment.gradients).rank).toBe(1);
    expect(Math.abs(assessment.gradients[0][0])).toBeLessThan(1e-8);
    problem.objects.find((object) => object.name === 'P')!.coordinates = { x: 0, y: 0 };
    expect(assessLocalConstraint({ kind: 'directed-angle-equation', terms: [{ angle: ['object:B', 'object:A', 'object:P'], coefficient: 1 }], pi: { numerator: 0, denominator: 1 } }, 'object:P', problem.objects, false)).toBeNull();
  });
});
