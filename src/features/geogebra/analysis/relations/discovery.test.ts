import { describe, expect, it } from 'vitest';
import { triangleCenterFixture } from '../__fixtures__/triangleCenters';
import { buildDependencyGraph } from '../constructionGraph';
import { detectGeometryRelations } from '../geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget } from './catalog';
import type { GeometryRelationKind } from './catalog';
import type { ConstructionObjectInput } from '../graphTypes';
import { buildGeometryScene } from '../scene/geometryScene';
import { detectMetricRelations } from './metricRelations';
import { formatRelation } from '../presentation/formatRelation';

const point = (name: string, x: number, y: number): ConstructionObjectInput => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });
const discover = (points: ConstructionObjectInput[], enabledKinds: GeometryRelationKind[], compressConsequences = true) => detectGeometryRelations(buildDependencyGraph(points), 0, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds, compressConsequences });

describe('direction generators rather than all pairwise angle relations', () => {
  it('covers O,H,I point stars of ABC while the generic centroid G stays outside that model', () => {
    const result = discover(triangleCenterFixture(), ['direction-space']);
    const model = result.relations.find((r) => r.id === 'direction-space:A|B|C')?.model;
    expect(model).toBeDefined();
    expect(model!.pointCover).toEqual(expect.arrayContaining(['A', 'B', 'C', 'O', 'H', 'I']));
    expect(model!.pointCover).not.toContain('G');
    expect(model!.generators).toHaveLength(2);
    expect(model!.members.length).toBeGreaterThanOrEqual(12);
  });
  it('compresses observed angle consequences with traceable sources', () => {
    const points = triangleCenterFixture();
    const expanded = discover(points, ['direction-space', 'equal-angles'], false);
    const compressed = discover(points, ['direction-space', 'equal-angles'], true);
    expect(expanded.relations.some((r) => r.kind === 'equal-angles' && r.derived)).toBe(true);
    expect(expanded.relations.filter((r) => r.derived).every((r) => r.nonTriviality === r.baseNonTriviality! * 0.25 && r.derivedFrom!.length > 0)).toBe(true);
    expect(expanded.relations.filter((r) => r.model).every((r) => r.model!.constraintRank > 0)).toBe(true);
    expect(compressed.relations.filter((r) => r.kind === 'equal-angles').length).toBeLessThan(expanded.relations.filter((r) => r.kind === 'equal-angles').length);
  });
  it('retains new equal-angle observations between different generator spaces', () => {
    const points = triangleCenterFixture();
    const extra = points.slice(0, 3).map((p, i) => {
      const value = p.coordinates!; const angle = 0.413879;
      return point(['U', 'V', 'W'][i], 20 + value.x * Math.cos(angle) - value.y * Math.sin(angle), 15 + value.x * Math.sin(angle) + value.y * Math.cos(angle));
    });
    const result = discover([...points, ...extra], ['direction-space', 'equal-angles']);
    expect(result.relations.some((r) => r.kind === 'equal-angles' && !r.derived && r.pointNames.includes('U'))).toBe(true);
  });
  it('preserves the ABC star cover across rotation, translation and changes of units', () => {
    for (const scale of [1e-8, 1, 1e8]) {
      const points = triangleCenterFixture().map((point) => {
        const p = point.coordinates!; const angle = 2.95;
        return { ...point, coordinates: { x: (p.x * Math.cos(angle) - p.y * Math.sin(angle) + 10) * scale, y: (p.x * Math.sin(angle) + p.y * Math.cos(angle) - 8) * scale } };
      });
      const model = discover(points, ['direction-space']).relations.find((r) => r.id === 'direction-space:A|B|C')?.model;
      expect(model?.pointCover).toEqual(expect.arrayContaining(['H', 'O', 'I']));
      expect(model?.pointCover).not.toContain('G');
    }
  });
});

describe('triangle shape indexing and relation refinements', () => {
  const triangle = [point('A', 0, 0), point('B', 3, 0), point('C', 0.7, 2)];
  const copy = (scale: number, mirror = false) => triangle.map((p, i) => point(['D', 'E', 'F'][i], 10 + p.coordinates!.x * scale, 5 + p.coordinates!.y * scale * (mirror ? -1 : 1)));
  it('recognizes rotated/scaled or mirrored triangles with an explicit vertex correspondence', () => {
    const result = discover([...triangle, ...copy(2, true)], ['similar-triangles', 'congruent-triangles']);
    expect(result.relations.some((r) => r.kind === 'similar-triangles' && r.pointNames.length === 6)).toBe(true);
    const pair = result.relations.find((r) => r.kind === 'similar-triangles' && r.pointNames.length === 6)!;
    expect(pair.witnesses[0].triangles).toHaveLength(2);
  });
  it('shows congruence instead of duplicating its similarity parent, but honors independent type controls', () => {
    const points = [...triangle, ...copy(1, true)];
    const result = discover(points, ['similar-triangles', 'congruent-triangles']);
    expect(result.relations.some((r) => r.kind === 'congruent-triangles' && r.pointNames.length === 6)).toBe(true);
    expect(result.relations.some((r) => r.kind === 'similar-triangles' && r.pointNames.length === 6)).toBe(false);
    expect(discover(points, ['similar-triangles']).relations.some((r) => r.pointNames.length === 6)).toBe(true);
  });
  it('does not report collinear or collapsed triples as triangles', () => {
    expect(discover([point('A', 0, 0), point('B', 1, 0), point('C', 2, 0), point('D', 0, 0)], ['similar-triangles', 'congruent-triangles']).relations).toEqual([]);
  });
  it('records a representative of equilateral triangle symmetries', () => {
    const first = [point('A', 0, 0), point('B', 2, 0), point('C', 1, Math.sqrt(3))];
    const second = first.map((p, i) => point(['D', 'E', 'F'][i], p.coordinates!.x + 10, p.coordinates!.y));
    expect(discover([...first, ...second], ['congruent-triangles']).relations.some((r) => r.witnesses[0].triangleSymmetryOrder === 6)).toBe(true);
  });
});

describe('new elementary observations and bounded search', () => {
  it('keeps independent coincident point identities', () => {
    const result = discover([point('P', 1, 1), point('Q', 1, 1)], ['coincident-points']);
    expect(result.relations[0].pointNames).toEqual(['P', 'Q']);
    expect(result.relations[0].nonTriviality).toBe(100);
  });
  it('does not expand a fixed-position proximity cluster into a false all-equal chain', () => {
    const points = [point('P', 0, 0), point('Q', 1.5e-7, 0), point('R', -1.5e-7, 0), point('A', 1, 0), point('B', 0, 1)];
    const result = discover(points, ['coincident-points']);
    expect(result.relations.every((r) => !(r.pointNames.includes('Q') && r.pointNames.includes('R')))).toBe(true);
  });
  it('uses cyclic constraints without treating them as a rank-two triangle model', () => {
    const points = [0.1, 1.3, 2.8, 5.2].map((angle, i) => point(['A', 'B', 'C', 'D'][i], Math.cos(angle), Math.sin(angle)));
    const expanded = discover(points, ['concyclic', 'equal-angles'], false);
    const compressed = discover(points, ['concyclic', 'equal-angles'], true);
    expect(expanded.relations.some((r) => r.derived)).toBe(true);
    expect(compressed.relations.filter((r) => r.kind === 'equal-angles').length).toBeLessThan(expanded.relations.filter((r) => r.kind === 'equal-angles').length);
  });
  it('finds equal lengths and ordinary angles in an isosceles triangle', () => {
    const result = discover([point('A', 0, 2), point('B', -1, 0), point('C', 1, 0)], ['equal-lengths', 'equal-angles']);
    expect(result.relations.some((r) => r.kind === 'equal-lengths')).toBe(true);
    expect(result.relations.some((r) => r.kind === 'equal-angles')).toBe(true);
  });
  it.each([1e-12, 1, 1e12])('excludes zero and near-zero distances from equal lengths at scale %s', (scale) => {
    const points = [point('I', 0, 0), point('Alias', 0, 0), point('Near', 1e-10, 0), point('Q', 1, 0), point('X', 0, 1)]
      .map((p) => ({ ...p, coordinates: { x: p.coordinates!.x * scale, y: p.coordinates!.y * scale } }));
    const result = discover(points, ['equal-lengths']);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].witnesses[0].segments).toEqual([['I', 'Q'], ['I', 'X']]);
    // In |I·Q|, the length bars resemble the point name I and · resembles
    // multiplication. Explicit distance notation avoids both ambiguities.
    expect(formatRelation(result.relations[0])).toBe('dist(I, Q) = dist(I, X)');
    expect(discover(points.slice(0, 3), ['equal-lengths']).relations).toEqual([]);
  });
  it('validates equal-length candidates against endpoints rather than accepting cached lengths', () => {
    const scene = buildGeometryScene(buildDependencyGraph([point('A', 0, 0), point('B', 1, 0), point('C', 0, 1)]), []);
    const length = scene.pairs[0].length;
    scene.pairs.push({ left: 0, right: 0, angle: 0, length }, { ...scene.pairs[0] },
      { ...scene.pairs[0], left: 1, right: 0 });
    // Also cover distinct names at one position and non-finite coordinates.
    scene.points.push({ name: 'Alias', aliases: ['Alias'], coordinates: scene.points[0].coordinates },
      { name: 'Invalid', aliases: ['Invalid'], coordinates: { x: NaN, y: 0 } });
    scene.pairs.push({ left: 0, right: 3, angle: 0, length }, { left: 0, right: 4, angle: 0, length });
    scene.pairs.find((pair) => pair.left === 1 && pair.right === 2)!.length = length;
    const options = { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['equal-lengths'] as GeometryRelationKind[] };
    const result = detectMetricRelations(scene, [], options, new DiscoveryBudget([]));
    expect(result).toHaveLength(1);
    expect(result[0].witness.segments).toEqual([['A', 'B'], ['A', 'C']]);
  });
  it('never identifies a 30-degree ordinary angle with its 150-degree supplement', () => {
    const result = discover([point('O', 0, 0), point('A', 1, 0), point('B', Math.sqrt(3) / 2, 0.5), point('P', 4, 0), point('Q', 5, 0), point('R', 4 - Math.sqrt(3) / 2, 0.5)], ['equal-angles']);
    expect(result.relations.some((r) => {
      const angles = r.witnesses[0].angles?.map((angle) => angle.join(',')) ?? [];
      return angles.includes('A,O,B') && angles.includes('Q,P,R');
    })).toBe(false);
  });
  it('does not run or emit disabled types', () => {
    expect(discover(triangleCenterFixture(), []).relations).toEqual([]);
  });
  it('reports budgets and does not pretend a zero budget proves there are no relations', () => {
    const result = detectGeometryRelations(buildDependencyGraph(triangleCenterFixture()), 0, { ...DEFAULT_DISCOVERY_OPTIONS, maxTriangles: 0, maxAngles: 0, maxModels: 0 });
    expect(result.diagnostics.join(' ')).toContain('partial');
  });
  it('retains the generator summary when the result budget would otherwise hide its low score', () => {
    const result = detectGeometryRelations(buildDependencyGraph(triangleCenterFixture()), 0, { ...DEFAULT_DISCOVERY_OPTIONS, maxRelations: 1 });
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].model).toBeDefined();
  });
});
