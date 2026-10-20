import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { pedalFixture, pedalSamples } from '../__fixtures__/pedal';
import { proposeConditions } from './proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from './types';

describe('black-box center and pedal characterizations', () => {
  for (const center of ['orthocenter', 'incenter'] as const) {
    it(`isolates ${center} and its feet using only independent observed conditions`, () => {
      const fixture = pedalFixture(center);
      const proposal = proposeConditions(fixture.graph, DEFAULT_CHARACTERIZATION_OPTIONS, pedalSamples(center));
      expect(proposal.coreIds).toHaveLength(8);
      for (const name of ['X', 'D', 'E', 'F']) {
        const report = proposal.objects.find((object) => object.objectId === `object:${name}`)!;
        expect(report.status).toBe('isolated-locally');
        expect(report.rank).toBe(2);
        expect(report.coreIds).toHaveLength(2);
      }
      const selected = proposal.problem.candidates.filter((entry) => proposal.coreIds.includes(entry.id));
      expect(selected.every((entry) => !entry.diagnostics.length && entry.evidence.kind === 'sampled'
        && entry.evidence.holdoutSamples === 2)).toBe(true);
      const opaque = buildDependencyGraph(fixture.graph.nodes.filter((node) => !node.isSentinel).map((node) => ({
        name: node.name, objectType: node.objectType, coordinates: node.coordinates,
        commandString: node.name === 'X' ? 'opaque(A,B,C)' : node.commandString,
      })), 123);
      const renamed = proposeConditions(opaque, DEFAULT_CHARACTERIZATION_OPTIONS, pedalSamples(center));
      expect(renamed.coreIds).toEqual(proposal.coreIds);
    });
  }
});
