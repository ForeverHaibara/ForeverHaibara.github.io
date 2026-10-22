import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from './constructionGraph';
import { detectGeometryRelations } from './geometryRelations';
import { DEFAULT_DISCOVERY_OPTIONS } from './relations/catalog';
import type { GeometryRelationKind } from './geometryTypes';
import { canonicalDirectionEquation } from './quantities/directedAngles';
import { fitRationalCombination } from './algebra/rationalSpace';

const point = (name: string, x: number, y: number) => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });
const discover = (points: ReturnType<typeof point>[], enabledKinds: GeometryRelationKind[]) => detectGeometryRelations(
  buildDependencyGraph(points), 0, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds, compressConsequences: false });

describe('floating point discovery precision', () => {
  it('separates points and lines whose differences disappear in a short display', () => {
    const result = discover([point('A', 0, 0), point('B', 1e-9, 0), point('C', 1, 0), point('D', 0.43, 1e-8)], ['coincident-points', 'collinear']);
    expect(result.pointCount).toBe(4);
    expect(result.relations.some((relation) => relation.kind === 'coincident-points')).toBe(false);
    expect(result.relations.filter((relation) => relation.kind === 'collinear').every((relation) => !relation.pointNames.includes('D'))).toBe(true);
  });

  it('rejects near midpoints and circles at the former 1e-7 matching scale', () => {
    expect(discover([point('A', 0, 0), point('B', 1, 0), point('M', 0.5, 1e-8)], ['midpoint']).relations).toHaveLength(0);
    expect(discover([point('A', 1, 0), point('B', 0, 1), point('C', -1, 0), point('D', 0, -1 - 1e-8)], ['concyclic']).relations).toHaveLength(0);
    expect(discover([point('A', 0, 0), point('B', 1, 0), point('C', 2, 1e-8), point('D', 3, 3.5e-8)], ['concyclic']).relations).toHaveLength(0);
  });

  it.each(['equal-angles', 'directed-angles', 'equal-lengths', 'congruent-triangles', 'similar-triangles'] as const)('rejects almost matching %s', (kind) => {
    const points = [point('A', 0, 0), point('B', 2, 0), point('C', 1, 3),
      point('D', 10, 7), point('E', 12 + 1e-8, 7), point('F', 11, 10 + 3e-8)];
    const result = discover(points, [kind]);
    if (kind === 'directed-angles') {
      const key = canonicalDirectionEquation([{ angle: ['B', 'A', 'C'], coefficient: 1 }, { angle: ['E', 'D', 'F'], coefficient: -1 }], { numerator: 0, denominator: 1 }).key;
      expect(result.relations.some((relation) => {
        const eq = relation.witnesses[0].equation!;
        return canonicalDirectionEquation(eq.terms.map((term) => ({ angle: term.quantity.points as [string, string, string], coefficient: term.coefficient })), eq.pi!).key === key;
      })).toBe(false);
    } else expect(result.relations.some((relation) => kind.includes('triangles')
      ? relation.witnesses[0].triangles?.some((triangle) => triangle.includes('A') && triangle.includes('B') && triangle.includes('C'))
        && relation.witnesses[0].triangles?.some((triangle) => triangle.includes('D') && triangle.includes('E') && triangle.includes('F'))
      : kind === 'equal-lengths' ? relation.witnesses[0].segments?.some((segment) => segment.includes('A') && segment.includes('B'))
        && relation.witnesses[0].segments?.some((segment) => segment.includes('D') && segment.includes('E'))
        : relation.witnesses[0].angles?.some((angle) => angle[1] === 'A') && relation.witnesses[0].angles?.some((angle) => angle[1] === 'D'))).toBe(false);
  });

  it('keeps roundoff-level true relations and does not fit approximate generator coefficients', () => {
    expect(discover([point('A', 1, 0), point('B', 0, 1), point('C', -1, 0), point('D', 0, -1 - 1e-14)], ['concyclic']).relations).toHaveLength(1);
    expect(fitRationalCombination(Math.PI / 3 + 1e-8, [], Math.PI)).toBeNull();
    expect(fitRationalCombination(Math.PI / 3, [], Math.PI)).not.toBeNull();
  });
});
