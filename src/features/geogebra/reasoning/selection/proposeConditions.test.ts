import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { midpointConstruction } from '../__fixtures__/problems';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import { triangleCenterFixture } from '../../analysis/__fixtures__/triangleCenters';
import { proposeConditions } from './proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from './types';
import { createSamplePlan, SAMPLING_SEED } from '../sampling/samplePlan';
import type { SamplingResult } from '../sampling/types';

const samplesForMidpoints = (graph = midpointConstruction()): SamplingResult => {
  const problem = createDiscoveryProblem(graph);
  const steps = createSamplePlan(problem.objects.filter((object) => !object.dependencies.length));
  return { seed: SAMPLING_SEED, diagnostics: [], variedPointIds: ['object:A', 'object:B', 'object:C'], samples: steps.map((step) => {
    const [a, b, c] = ['A', 'B', 'C'].map((name) => step.points.find((point) => point.name === name)!);
    return { index: step.index, phase: step.phase, coordinates: { 'object:A': a, 'object:B': b, 'object:C': c,
      'object:M': { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'object:N': { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 } } };
  }) };
};

describe('local black-box characterization', () => {
  it('selects midpoint properties from opaque definitions without using later objects', () => {
    const proposal = proposeConditions(midpointConstruction());
    expect(proposal.coreIds).toHaveLength(2);
    for (const name of ['M', 'N']) {
      const report = proposal.objects.find((object) => object.objectId === `object:${name}`)!;
      expect(report.rank).toBe(2);
      expect(report.coreIds).toHaveLength(1);
      expect(proposal.problem.candidates.find((candidate) => candidate.id === report.coreIds[0])?.predicates[0].kind).toBe('midpoint');
    }
    expect(proposal.objects.find((object) => object.objectId === 'object:M')?.scopeIds).not.toContain('object:N');
    expect(proposal.objects.find((object) => object.objectId === 'object:N')?.scopeIds).not.toContain('object:M');
  });

  it('retains object references inside literal lists in opaque expressions', () => {
    const graph = midpointConstruction();
    expect(graph.nodes.find((node) => node.name === 'M')?.parsed?.dependencies).toContain('C');
  });

  it('is independent of discovery display settings and array insertion order after dependencies', () => {
    const graph = midpointConstruction();
    graph.nodes = [...graph.nodes].reverse();
    const proposal = proposeConditions(graph, { ...DEFAULT_CHARACTERIZATION_OPTIONS, allowEarlierContext: false });
    expect(proposal.coreIds).toHaveLength(2);
    expect(proposal.problem.candidates.every((candidate) => candidate.characterization)).toBe(true);
  });

  it('describes O, H and I with local conditions without interpreting triangle-center names', () => {
    const graph = buildDependencyGraph(triangleCenterFixture().filter((point) => point.name !== 'G').map((point) => ({ ...point,
      commandString: point.commandString ? 'opaque(A,B,C)' : '' })), 123);
    const proposal = proposeConditions(graph, { ...DEFAULT_CHARACTERIZATION_OPTIONS, allowEarlierContext: false });
    for (const name of ['O', 'H', 'I']) expect(proposal.objects.find((object) => object.objectId === `object:${name}`)?.rank).toBe(2);
  });

  it('keeps an intentional one-dimensional locus partial rather than adding unrelated constraints', () => {
    const graph = buildDependencyGraph([
      { name: 'A', coordinates: { x: 0, y: 0 }, commandString: '' }, { name: 'B', coordinates: { x: 5, y: 0 }, commandString: '' },
      { name: 'P', coordinates: { x: 1.37, y: 0 }, commandString: 'opaque(A,B)' },
    ].map((point) => ({ ...point, objectType: 'point' })), 123);
    const report = proposeConditions(graph).objects.find((object) => object.objectId === 'object:P')!;
    expect(report.rank).toBe(1); expect(report.status).toBe('partial'); expect(report.coreIds).toHaveLength(1);
  });

  it('refuses cyclic and unreadable dependencies', () => {
    const graph = midpointConstruction();
    graph.edges.push({ id: 'cycle', source: 'object:M', target: 'object:A', kind: 'dependency' });
    const proposal = proposeConditions(graph);
    expect(proposal.coreIds).toHaveLength(0);
    expect(proposal.objects.some((object) => object.status === 'unavailable')).toBe(true);
  });

  it('rejects special-position coincidences using independent discovery configurations', () => {
    const graph = midpointConstruction();
    graph.nodes.find((node) => node.name === 'C')!.coordinates = { x: 3, y: 4 };
    graph.nodes.find((node) => node.name === 'N')!.coordinates = { x: 1.5, y: 2 };
    const proposal = proposeConditions(graph, DEFAULT_CHARACTERIZATION_OPTIONS, samplesForMidpoints(graph));
    expect(proposal.coreIds).toHaveLength(2);
    expect(proposal.objects.reduce((sum, object) => sum + object.rejectedCandidates, 0)).toBeGreaterThan(0);
    for (const id of proposal.coreIds) expect(proposal.problem.candidates.find((candidate) => candidate.id === id)?.evidence).toMatchObject({ kind: 'sampled', discoverySamples: 4, holdoutSamples: 2 });
  });

  it('removes a failed held-out characterization without fitting replacement properties to the holdout', () => {
    const sampling = samplesForMidpoints();
    sampling.samples[4].coordinates['object:M']!.y += 0.05;
    const proposal = proposeConditions(midpointConstruction(), DEFAULT_CHARACTERIZATION_OPTIONS, sampling);
    const report = proposal.objects.find((object) => object.objectId === 'object:M')!;
    expect(report.coreIds).toHaveLength(0); expect(report.rank).toBe(0);
    expect(report.diagnostics.join(' ')).toContain('no replacements');
  });

  it('rejects held-out errors small enough to disappear in display rounding', () => {
    const sampling = samplesForMidpoints();
    sampling.samples[4].coordinates['object:M']!.y += 5e-8;
    const proposal = proposeConditions(midpointConstruction(), DEFAULT_CHARACTERIZATION_OPTIONS, sampling);
    const report = proposal.objects.find((object) => object.objectId === 'object:M')!;
    expect(report.coreIds).toHaveLength(0);
    const rejected = proposal.problem.candidates.find((entry) => entry.characterization?.objectId === 'object:M' && entry.predicates[0].kind === 'midpoint')!;
    expect(rejected.hypothesisEligible).toBe(true);
    expect(rejected.diagnostics.join(' ')).toContain('held-out');
  });
});
