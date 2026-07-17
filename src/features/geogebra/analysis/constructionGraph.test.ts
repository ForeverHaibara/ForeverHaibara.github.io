import { describe, expect, it } from 'vitest';
import { parseConstruction } from './expressionParser';
import { buildDependencyGraph, projectGraph } from './constructionGraph';
import { FREE_OBJECT_ROOT_ID, objectNodeId } from './graphTypes';
import { detectGeometryRelations } from './geometryRelations';

describe('GeoGebra construction parser', () => {
  it('keeps nested calls in the AST but extracts only known object dependencies', () => {
    const parsed = parseConstruction('Reflect(A,Line(B,C))', ['A', 'B', 'C', 'D']);
    expect(parsed.status).toBe('parsed');
    expect(parsed.dependencies).toEqual(['A', 'B', 'C']);
    expect(parsed.ast?.kind).toBe('call');
  });

  it('matches complex object names and user-defined tool calls', () => {
    const parsed = parseConstruction('MyTool(A_{123}, B) + C^2', ['A_{123}', 'B', 'C']);
    expect(parsed.dependencies).toEqual(['A_{123}', 'B', 'C']);
  });

  it('returns diagnostics instead of throwing on malformed input', () => {
    const parsed = parseConstruction('Reflect(A,Line(B,C)', ['A', 'B', 'C']);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    expect(parsed.ast).not.toBeNull();
  });
});

describe('GeoGebra dependency graph', () => {
  it('connects free objects to the sentinel root and builds dependency edges', () => {
    const graph = buildDependencyGraph([
      { name: 'A', objectType: 'point', commandString: '' },
      { name: 'B', objectType: 'point', commandString: 'A + 1' },
      { name: 'D', objectType: 'point', commandString: 'Reflect(A,Line(B,C))' },
      { name: 'C', objectType: 'line', commandString: '' },
    ]);
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: FREE_OBJECT_ROOT_ID, target: objectNodeId('A') }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: objectNodeId('A'), target: objectNodeId('B') }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: objectNodeId('C'), target: objectNodeId('D') }));
    expect(graph.edges.filter((edge) => edge.target === objectNodeId('D'))).toHaveLength(3);
  });

  it('compresses hidden vertices and removes self-loops', () => {
    const graph = buildDependencyGraph([
      { name: 'a', objectType: 'point', commandString: '' },
      { name: 'b', objectType: 'line', commandString: 'a' },
      { name: 'c', objectType: 'point', commandString: 'b' },
    ]);
    const projected = projectGraph(graph, { visibleTypes: new Set(['point']), includeRoot: true, compressHidden: true });
    expect(projected.nodes.map((node) => node.name)).toEqual(expect.arrayContaining(['a', 'c', FREE_OBJECT_ROOT_ID]));
    expect(projected.edges).toContainEqual(expect.objectContaining({ source: objectNodeId('a'), target: objectNodeId('c') }));
    expect(projected.edges.every((edge) => edge.source !== edge.target)).toBe(true);
  });
});

const point = (name: string, x: number, y: number) => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });

describe('GeoGebra geometric relation discovery', () => {
  it('discovers collinear and parallel point relations without line objects', () => {
    const graph = buildDependencyGraph([
      point('A', 0, 0), point('B', 2, 0), point('C', 0, 1), point('D', 2, 1),
      point('E', 4, 0), point('F', 6, 0),
    ]);
    const result = detectGeometryRelations(graph);
    expect(result.relations.some((relation) => relation.kind === 'parallel' && relation.pointNames.includes('A') && relation.pointNames.includes('D'))).toBe(true);
    expect(result.relations.some((relation) => relation.kind === 'collinear' && relation.pointNames.includes('A') && relation.pointNames.includes('F'))).toBe(true);
  });

  it('discovers perpendicular relations and rejects degenerate point pairs', () => {
    const graph = buildDependencyGraph([
      point('A', 0, 0), point('B', 2, 0), point('C', 0, 1), point('D', 0, 3), point('E', 0, 0),
    ]);
    const result = detectGeometryRelations(graph);
    expect(result.relations.some((relation) => relation.kind === 'perpendicular' && relation.pointNames.includes('A') && relation.pointNames.includes('B') && relation.pointNames.includes('C') && relation.pointNames.includes('D'))).toBe(true);
  });

  it('merges points on the same circle through overlapping four-point candidates', () => {
    const graph = buildDependencyGraph([
      point('A', 1, 0), point('B', 0, 1), point('C', -1, 0), point('D', 0, -1), point('E', Math.SQRT1_2, Math.SQRT1_2),
    ]);
    const result = detectGeometryRelations(graph);
    const concyclic = result.relations.find((relation) => relation.kind === 'concyclic');
    expect(concyclic?.pointNames).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E']));
  });

  it('orders relations by the dependency-based novelty score', () => {
    const graph = buildDependencyGraph([
      point('A', 0, 0), point('B', 2, 0), point('C', 0, 1), point('D', 2, 1), point('E', 0, 2), point('F', 2, 2),
    ]);
    const result = detectGeometryRelations(graph);
    expect(result.relations.every((relation, index) => index === 0 || relation.nonTriviality <= result.relations[index - 1].nonTriviality)).toBe(true);
  });
});
