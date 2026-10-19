import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../constructionGraph';
import { detectGeometryRelations } from '../geometryRelations';
import type { ConstructionObjectInput } from '../graphTypes';
import type { GeometricQuantity } from '../geometryTypes';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget } from './catalog';
import type { GeometryRelationKind } from './catalog';
import { formatEquation } from '../presentation/formatRelation';
import { scalarClass } from '../algebra/scalarClasses';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { buildGeometryScene } from '../scene/geometryScene';
import { detectAngleRelations } from './angleRelations';
import type { AngleQuantity } from './angleRelations';

const point = (name: string, x: number, y: number): ConstructionObjectInput => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });
const angleKey = (quantity: GeometricQuantity) => quantity.kind === 'angle'
  ? `${quantity.points[1]}:${[quantity.points[0], quantity.points[2]].sort().join(',')}` : quantity.points.slice().sort().join(',');
const angleFixture = (values: number[]) => values.flatMap((value, i) => {
  const rotation = i * 0.25317; const x = i * 5.137; const y = i * i * 1.713;
  return [point(`A${i}`, x + Math.cos(rotation), y + Math.sin(rotation)), point(`V${i}`, x, y),
    point(`B${i}`, x + Math.cos(rotation + value), y + Math.sin(rotation + value))];
});
const discover = (points: ConstructionObjectInput[], kind: GeometryRelationKind) => detectGeometryRelations(buildDependencyGraph(points), 0,
  { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: [kind], compressConsequences: false });

describe('equivalence classes remain visible in affine geometric relations', () => {
  it.each([
    ['angle-multiple', (a: number) => 2 * a],
    ['complementary-angles', (a: number) => Math.PI / 2 - a],
    ['supplementary-angles', (a: number) => Math.PI - a],
  ] as const)('publishes one %s statement containing both full equal-angle classes', (kind, transform) => {
    const a = 0.371353;
    const fixture = angleFixture([a, a, transform(a), transform(a)]);
    const result = discover(fixture, kind);
    const matches = result.relations.filter((relation) => {
      const classes = relation.witnesses[0].equation!.terms.map((term) => (term.equivalents ?? [term.quantity]).map(angleKey));
      return classes.some((group) => group.includes('V0:A0,B0') && group.includes('V1:A1,B1'))
        && classes.some((group) => group.includes('V2:A2,B2') && group.includes('V3:A3,B3'));
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].pointNames).toEqual(expect.arrayContaining(fixture.map((p) => p.name)));
    expect(matches[0].metric.pointCount).toBe(fixture.length);
    const equation = matches[0].witnesses[0].equation!;
    expect(formatEquation(equation).match(/ = /g)!.length).toBeGreaterThanOrEqual(3);
    if (kind === 'complementary-angles') expect(formatEquation(equation)).toContain(' = π/2');
    if (kind === 'supplementary-angles') expect(formatEquation(equation)).toContain(' = π');
  });
  it('groups all equal short and long lengths in one fixed-ratio statement', () => {
    const fixture = [point('A', 0, 0), point('B', 1, 0), point('C', 0, 1), point('D', 1, 1),
      point('E', 10, 3), point('F', 12, 3), point('G', 10, 6), point('H', 12, 6)];
    const result = discover(fixture, 'length-multiple');
    const matches = result.relations.filter((relation) => {
      const classes = relation.witnesses[0].equation!.terms.map((term) => (term.equivalents ?? [term.quantity]).map(angleKey));
      return classes.some((group) => group.includes('A,B') && group.includes('C,D'))
        && classes.some((group) => group.includes('E,F') && group.includes('G,H'));
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].pointNames).toEqual(expect.arrayContaining(fixture.map((p) => p.name)));
  });
  it.each([
    ['complementary-angles', Math.PI / 4], ['supplementary-angles', Math.PI / 2],
  ] as const)('represents two equal %s members as one doubled class', (kind, value) => {
    const result = discover(angleFixture([value, value]), kind);
    const target = result.relations.find((relation) => relation.witnesses[0].equation!.terms.some((term) => {
      const members = (term.equivalents ?? [term.quantity]).map(angleKey);
      return members.includes('V0:A0,B0') && members.includes('V1:A1,B1');
    }));
    expect(target).toBeDefined();
    expect(target!.witnesses[0].equation!.terms).toHaveLength(1);
    expect(target!.witnesses[0].equation!.terms[0].coefficient).toBe(2);
  });
});

describe('clustered statements are validated as whole statements', () => {
  const fixture = angleFixture([0.3, 0.3, 0.6, 0.6]);
  const scene = buildGeometryScene(buildDependencyGraph(fixture), []);
  const options = { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['angle-multiple'] as GeometryRelationKind[] };
  const quantity = (i: number, value: number): AngleQuantity => ({ value, names: [`A${i}`, `V${i}`, `B${i}`], indexes: [3 * i, 3 * i + 1, 3 * i + 2], row: { [`a${i}`]: 1 }, representationError: 0 });
  it('does not hide fresh class membership merely because representative doubling is known', () => {
    const space = new RationalRelationSpace(); space.insert({ a2: 1, a0: -2 }, 'known-representatives');
    const groups = [scalarClass([quantity(0, 0.3), quantity(1, 0.3)]), scalarClass([quantity(2, 0.6), quantity(3, 0.6)])];
    const first = detectAngleRelations(scene, groups, options, new DiscoveryBudget([]), space);
    expect(first).toHaveLength(1);
    expect(first[0].derived).toBe(false);
    expect(first[0].points.size).toBe(12);
    expect(detectAngleRelations(scene, groups, options, new DiscoveryBudget([]), space)).toEqual([]);
  });
  it('rejects a whole-class double-angle assertion when only the representatives match', () => {
    const groups = [scalarClass([quantity(0, 0.3), quantity(1, 0.3 + 3e-7)]), scalarClass([quantity(2, 0.6), quantity(3, 0.6 + 3e-7)])];
    expect(detectAngleRelations(scene, groups, options, new DiscoveryBudget([]), new RationalRelationSpace())).toEqual([]);
  });
  it('retains new equality information when the representative equation is a telescope identity', () => {
    const a = quantity(0, 0.3); const other = quantity(1, 0.3);
    const doubled = { ...quantity(2, 0.6), row: { a0: 2 } };
    const groups = [scalarClass([a, other]), scalarClass([doubled])];
    const found = detectAngleRelations(scene, groups, options, new DiscoveryBudget([]), new RationalRelationSpace());
    expect(found).toHaveLength(1);
    expect(found[0].derived).toBe(false);
  });
});
