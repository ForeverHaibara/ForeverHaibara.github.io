import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from './constructionGraph';
import { detectGeometryRelations } from './geometryRelations';
import type { ConstructionObjectInput } from './graphTypes';

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

describe('relation value on geometric configurations', () => {
  const constructed = (name: string, x: number, y: number, commandString: string) => ({ ...point(name, x, y), commandString });

  it('ranks an unexplained free-point collinearity above a local midpoint collinearity', () => {
    const result = detectGeometryRelations(buildDependencyGraph([
      point('A', 0, 0), point('B', 4, 0), constructed('M', 2, 0, 'Mystery(A,B)'),
      point('U', 0, 1), point('V', 1, 1), point('W', 2, 1),
    ]));
    const local = result.relations.find((relation) => relation.kind === 'collinear' && relation.pointNames.includes('M'))!;
    const unexplained = result.relations.find((relation) => relation.kind === 'collinear' && relation.pointNames.includes('U'))!;
    expect(local.nonTriviality).toBeLessThan(10);
    expect(unexplained.nonTriviality).toBeGreaterThan(local.nonTriviality);
    expect(result.relations.indexOf(unexplained)).toBeLessThan(result.relations.indexOf(local));
  });

  it('finds and scores the symmedian collinearity as a local property of ABC', () => {
    const result = detectGeometryRelations(buildDependencyGraph([
      point('A', 0, 2), point('B', -1, 0), point('C', 3, 0),
      constructed('K', 1 / 17, 16 / 17, 'TriangleCenter(A,B,C,6)'),
      constructed('D', 0.2, -1.6, 'HarmonicConjugate(B,C,A)'),
    ]));
    const symmedian = result.relations.find((relation) => relation.kind === 'collinear' && ['A', 'K', 'D'].every((name) => relation.pointNames.includes(name)))!;
    expect(symmedian).toBeDefined();
    expect(symmedian.nonTriviality).toBeLessThan(15);
  });

  it('distinguishes points placed on a circle from an unexplained cyclic configuration', () => {
    const points = [point('P', 1, 0), point('Q', 0, 1), point('R', -1, 0), point('S', 0, -1)];
    const onCircle = detectGeometryRelations(buildDependencyGraph([
      { name: 'c', objectType: 'circle', commandString: '' }, ...points.map((node) => ({ ...node, commandString: 'Point(c)' })),
    ])).relations.find((relation) => relation.kind === 'concyclic')!;
    const freeCircle = discover(points).relations.find((relation) => relation.kind === 'concyclic')!;
    expect(onCircle.nonTriviality).toBeLessThan(15);
    expect(freeCircle.nonTriviality).toBeGreaterThan(onCircle.nonTriviality);
  });

  it('scores all collinear positions even when the displayed witness stops at eight', () => {
    const result = detectGeometryRelations(buildDependencyGraph([
      point('A', 0, 0), point('B', 10, 0),
      ...Array.from({ length: 7 }, (_, index) => constructed(`M${index}`, index + 1, 0, 'F(A,B)')),
      point('Z', 20, 0),
    ]));
    const line = result.relations.find((relation) => relation.kind === 'collinear')!;
    expect(line.pointNames).toHaveLength(10);
    expect(line.witnesses[0].points).toHaveLength(8);
    expect(line.witnesses[0].points).not.toContain('Z');
    expect(line.metric.pointCount).toBe(10);
    expect(line.nonTriviality).toBe(100);
  });

  it('scores all cyclic positions even when the displayed witness stops at eight', () => {
    const points = Array.from({ length: 10 }, (_, index) => constructed(`P${index}`,
      Math.cos(2 * Math.PI * index / 10), Math.sin(2 * Math.PI * index / 10), index === 9 ? '' : 'Point(c)'));
    const result = detectGeometryRelations(buildDependencyGraph([{ name: 'c', objectType: 'circle', commandString: '' }, ...points]));
    const circle = result.relations.find((relation) => relation.kind === 'concyclic')!;
    expect(circle.pointNames).toHaveLength(10);
    expect(circle.witnesses[0].points).toHaveLength(8);
    expect(circle.metric.pointCount).toBe(10);
    expect(circle.nonTriviality).toBe(100);
  });

  it('ranks the Pappus line above the two defining lines, with a modest cost for named intermediates', () => {
    const objects: ConstructionObjectInput[] = [
      { name: 'l', objectType: 'line', commandString: '' }, { name: 'm', objectType: 'line', commandString: '' },
      constructed('A', 0, 0, 'Point(l)'), constructed('B', 1, 0, 'Point(l)'), constructed('C', 4, 0, 'Point(l)'),
      constructed('Ap', 0.5, 2, 'Point(m)'), constructed('Bp', 2, 2, 'Point(m)'), constructed('Cp', 5, 2, 'Point(m)'),
    ];
    const intersect = (name: string, a: string, b: string, c: string, d: string) => {
      const [p, q, r, s] = [a, b, c, d].map((label) => objects.find((node) => node.name === label)!.coordinates!);
      const dx = q.x - p.x; const dy = q.y - p.y;
      const ex = s.x - r.x; const ey = s.y - r.y;
      const t = ((r.x - p.x) * ey - (r.y - p.y) * ex) / (dx * ey - dy * ex);
      return constructed(name, p.x + t * dx, p.y + t * dy, `Intersect(Line(${a},${b}),Line(${c},${d}))`);
    };
    const crossings = [intersect('X', 'A', 'Bp', 'Ap', 'B'), intersect('Y', 'A', 'Cp', 'Ap', 'C'), intersect('Z', 'B', 'Cp', 'Bp', 'C')];
    const relations = detectGeometryRelations(buildDependencyGraph([...objects, ...crossings])).relations;
    const findLine = (names: string[]) => relations.find((relation) => relation.kind === 'collinear' && names.every((name) => relation.pointNames.includes(name)))!;
    const pappus = findLine(['X', 'Y', 'Z']);
    expect(pappus).toBeDefined();
    expect(pappus.nonTriviality).toBeGreaterThan(findLine(['A', 'B', 'C']).nonTriviality);
    expect(pappus.nonTriviality).toBeGreaterThan(findLine(['Ap', 'Bp', 'Cp']).nonTriviality);
    const expanded = crossings.flatMap((node, index) => {
      const pairs = [['A', 'Bp', 'Ap', 'B'], ['A', 'Cp', 'Ap', 'C'], ['B', 'Cp', 'Bp', 'C']][index];
      return [
        { name: `u${index}`, objectType: 'line', commandString: `Line(${pairs[0]},${pairs[1]})` },
        { name: `v${index}`, objectType: 'line', commandString: `Line(${pairs[2]},${pairs[3]})` },
        { ...node, commandString: `Intersect(u${index},v${index})` },
      ];
    });
    const expandedPappus = detectGeometryRelations(buildDependencyGraph([...objects, ...expanded])).relations
      .find((relation) => relation.kind === 'collinear' && ['X', 'Y', 'Z'].every((name) => relation.pointNames.includes(name)))!;
    expect(expandedPappus.nonTriviality).toBeGreaterThan(pappus.nonTriviality);
    expect(expandedPappus.nonTriviality - pappus.nonTriviality).toBeLessThan(20);
  });
});
