import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import type { GeometryRelation } from '../../analysis/geometryTypes';
import { createDiscoveryProblem } from './discoveryProblem';

describe('observations to conditional candidates', () => {
  const graph = () => buildDependencyGraph(['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ name, objectType: 'point', commandString: '', coordinates: { x: i % 3, y: Math.floor(i / 3) } })), 123);
  const convert = (overrides: Partial<GeometryRelation>) => {
    const input = graph(); const result = detectGeometryRelations(input, 123);
    const relation = { ...result.relations[0], ...overrides };
    return createDiscoveryProblem(input, { ...result, relations: [relation] }).candidates[0];
  };

  it('retains line incidence when exporting grouped parallel lines', () => {
    const entry = convert({ kind: 'parallel', witnesses: [{ points: ['A', 'B', 'C', 'D', 'E', 'F'], lineFamilies: [[['A', 'B', 'C'], ['D', 'E', 'F']]] }] });
    expect(entry.predicates.map((predicate) => predicate.kind)).toEqual(['collinear', 'collinear', 'parallel']);
  });

  it('exports each finite family witness without completing unobserved bindings', () => {
    const entry = convert({ kind: 'equal-lengths', family: { fixed: [], commonConditions: [], instances: [
      { binding: 'A', sourceId: 'one', witness: { points: ['A', 'B', 'D', 'E'], segments: [['A', 'B'], ['D', 'E']] } },
      { binding: 'B', sourceId: 'two', witness: { points: ['B', 'C', 'E', 'F'], segments: [['B', 'C'], ['E', 'F']] } },
    ] } });
    expect(entry.predicates).toHaveLength(2);
    expect(entry.predicates[0]).toEqual({ kind: 'equal-length', segments: [['object:A', 'object:B'], ['object:D', 'object:E']] });
  });

  it('chooses a separated line anchor rather than two coincident aliases', () => {
    const input = graph();
    input.nodes.find((node) => node.name === 'B')!.coordinates = { x: 0, y: 0 };
    const result = detectGeometryRelations(input, 123);
    const relation: GeometryRelation = { ...result.relations[0], kind: 'parallel', witnesses: [
      { points: ['A', 'B', 'C', 'D', 'F'], lineFamilies: [[['A', 'B', 'C'], ['D', 'F']]] },
    ] };
    const entry = createDiscoveryProblem(input, { ...result, relations: [relation] }).candidates[0];
    expect(entry.predicates.find((predicate) => predicate.kind === 'parallel')).toEqual({ kind: 'parallel', segments: [
      ['object:A', 'object:C'], ['object:D', 'object:F'],
    ] });
  });
});
