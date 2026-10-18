import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from './constructionGraph';
import { detectGeometryRelations } from './geometryRelations';

const point = (name: string, x: number, y: number) => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });
const discover = (points: ReturnType<typeof point>[]) => detectGeometryRelations(buildDependencyGraph(points));

describe('geometry relation numerical stability', () => {
  const square = [point('A', 0, 0), point('B', 2, 0), point('C', 2, 2), point('D', 0, 2)];

  it.each([1e12, 1e100, Number.MAX_VALUE])('isolates a distant unstable point at %s without changing local relations', (distance) => {
    const baseline = discover(square);
    const result = discover([point('P', distance, -distance), ...square]);
    expect(result.relations.map(({ kind, pointNames }) => ({ kind, pointNames })))
      .toEqual(baseline.relations.map(({ kind, pointNames }) => ({ kind, pointNames })));
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it.each([1e-12, 1, 1e100])('preserves relations under uniform scaling by %s', (scale) => {
    const result = discover(square.map((p) => point(p.name, p.coordinates.x * scale, p.coordinates.y * scale)));
    expect(result.relations.map(({ kind, pointNames }) => ({ kind, pointNames })))
      .toEqual(discover(square).relations.map(({ kind, pointNames }) => ({ kind, pointNames })));
  });

  it('preserves circle discovery far from the coordinate origin', () => {
    const result = discover(square.map((p) => point(p.name, p.coordinates.x + 1e12, p.coordinates.y - 1e12)));
    expect(result.relations.find((relation) => relation.kind === 'concyclic')?.pointNames).toEqual(['A', 'B', 'C', 'D']);
    expect(result.relations.some((relation) => relation.kind === 'collinear')).toBe(false);
  });

  it('rejects nearly collinear triples as circle seeds', () => {
    const result = discover([point('A', 0, 0), point('B', 1, 0), point('C', 2, 1e-12), point('D', 3, 5e-12)]);
    expect(result.relations.some((relation) => relation.kind === 'concyclic')).toBe(false);
  });

  it('ignores non-finite coordinates', () => {
    expect(discover([...square, point('P', Infinity, 0), point('Q', NaN, 1)]).relations).toEqual(discover(square).relations);
  });

  it('does not report converging almost parallel rays as parallel', () => {
    const result = discover([point('A', 0, 0), point('B', 0, 0.01), point('C', 1, 0), point('P', 1e6, 1e6)]);
    expect(result.relations.some((relation) => relation.kind === 'parallel' && relation.pointNames.includes('P'))).toBe(false);
  });
});

describe('coincident geometry points', () => {
  it('requires three distinct positions for collinearity and four for concyclicity', () => {
    const result = discover([point('A', 0, 0), point('B', 0, 0), point('C', 2, 0), point('D', 0, 2)]);
    expect(result.relations.filter((relation) => relation.kind === 'collinear' || relation.kind === 'concyclic')).toEqual([]);
  });

  it('does not infer relations from any number of names at one position', () => {
    const result = discover(Array.from({ length: 12 }, (_, i) => point(`P${i}`, 1, 1)));
    expect(result.relations).toEqual([]);
  });

  it('expands coincident names only after discovering a genuine line', () => {
    const result = discover([point('A', 0, 0), point('B', 2, 0), point('C', 4, 0), point('X', 2, 0), point('Y', 2 + 1e-9, 0)]);
    const lines = result.relations.filter((relation) => relation.kind === 'collinear');
    expect(lines).toHaveLength(1);
    expect(lines[0].pointNames).toEqual(['A', 'B', 'C', 'X', 'Y']);
    expect(lines[0].witnesses[0].lineFamilies).toEqual([[['A', 'B', 'X', 'Y', 'C']]]);
    expect(result.relations.some((relation) => relation.kind === 'parallel' || relation.kind === 'concyclic')).toBe(false);
  });

  it('preserves the score and expands aliases in circle and direction witnesses', () => {
    const points = [point('A', 0, 0), point('B', 2, 0), point('C', 2, 2), point('D', 0, 2)];
    const baseline = discover(points);
    const result = discover([...points, point('X', 0, 0), point('Y', 2, 0)]);
    expect(result.relations.map(({ id, nonTriviality }) => ({ id, nonTriviality })))
      .toEqual(baseline.relations.map(({ id, nonTriviality }) => ({ id, nonTriviality })));
    expect(result.relations.find((relation) => relation.kind === 'concyclic')?.witnesses[0].points).toEqual(['A', 'B', 'C', 'D', 'X', 'Y']);
    expect(result.relations.find((relation) => relation.kind === 'parallel')?.witnesses[0].lineFamilies?.flat(2)).toContain('X');
    expect(result.relations.find((relation) => relation.kind === 'perpendicular')?.witnesses[0].lineFamilies?.flat(2)).toContain('Y');
  });

  it('deduplicates small numerical differences before counting circle points', () => {
    const result = discover([point('A', 0, 0), point('B', 2, 0), point('C', 0, 2), point('X', 1e-9, 0), point('Y', 2, 1e-9), point('Z', 0, 2 + 1e-9)]);
    expect(result.relations.filter((relation) => relation.kind === 'collinear' || relation.kind === 'concyclic')).toEqual([]);
  });
});
