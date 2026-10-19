import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../constructionGraph';
import { detectGeometryRelations } from '../geometryRelations';
import type { ConstructionObjectInput } from '../graphTypes';
import type { QuantityEquation } from '../geometryTypes';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget } from './catalog';
import type { DiscoveryOptions, GeometryRelationKind } from './catalog';
import { formatLengthMember, formatRelation } from '../presentation/formatRelation';
import { buildGeometryScene } from '../scene/geometryScene';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { detectAngleRelations } from './angleRelations';
import type { AngleQuantity } from './angleRelations';
import { scalarClass } from '../algebra/scalarClasses';

const point = (name: string, x: number, y: number): ConstructionObjectInput => ({ name, objectType: 'point', commandString: '', coordinates: { x, y } });
const discover = (points: ConstructionObjectInput[], kinds: GeometryRelationKind[], extra: Partial<DiscoveryOptions> = {}) =>
  detectGeometryRelations(buildDependencyGraph(points), 0, { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: kinds, ...extra });
const equationResidual = (points: ConstructionObjectInput[], equation: QuantityEquation) => {
  const byName = new Map(points.map((p) => [p.name, p.coordinates!]));
  return equation.terms.reduce((sum, { coefficient, quantity }) => {
    const [a, b, c] = quantity.points.map((name) => byName.get(name)!);
    if (quantity.kind === 'length') return sum + coefficient * Math.hypot(a.x - b.x, a.y - b.y);
    const u = { x: a.x - b.x, y: a.y - b.y }; const v = { x: c.x - b.x, y: c.y - b.y };
    return sum + coefficient * Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y);
  }, 0) - (equation.pi ? equation.pi.numerator * Math.PI / equation.pi.denominator : 0);
};
const midpoint = [point('A', 0, 0), point('B', 4, 0), point('M', 2, 0)];
const rootLengths = [point('A', 0, 0), point('B', 1, 0), point('C', 0, 1.729), point('D', Math.SQRT2, 0), point('E', -Math.SQRT2, 0)];
const anglePair = (first: number, second: number) => [point('A', 1, 0), point('O', 0, 0), point('B', Math.cos(first), Math.sin(first)),
  point('C', 7, 3), point('P', 6, 3), point('D', 6 + Math.cos(second), 3 + Math.sin(second))];

describe('midpoints and fixed ratios on positive lengths', () => {
  it('requires a nondegenerate midpoint, not just two equal distances', () => {
    const result = discover([...midpoint, point('Off', 2, 1), point('Alias', 0, 0)], ['midpoint']);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].witnesses[0].midpoint).toEqual({ point: 'M', segment: ['A', 'B'] });
    expect(formatRelation(result.relations[0])).toBe('M is the midpoint of (A, B)');
    expect(discover([point('A', 0, 0), point('M', 1e-10, 0), point('B', 2e-10, 0), point('Far', 1, 1), point('Far2', 2.39, 0.179), point('Far3', 0.418, 3.172)], ['midpoint']).relations).toEqual([]);
  });
  it('compresses equal halves and twice-the-half observations with the midpoint source', () => {
    const kinds: GeometryRelationKind[] = ['midpoint', 'equal-lengths', 'length-multiple'];
    const compressed = discover(midpoint, kinds); const expanded = discover(midpoint, kinds, { compressConsequences: false });
    expect(compressed.relations.map((r) => r.kind)).toEqual(['midpoint']);
    expect(expanded.relations.some((r) => r.kind === 'equal-lengths' && r.derived)).toBe(true);
    expect(expanded.relations.some((r) => r.kind === 'length-multiple' && r.derived)).toBe(true);
    expect(expanded.relations.filter((r) => r.derived).every((r) => r.derivedFrom?.some((id) => id.startsWith('midpoint:')))).toBe(true);
    expect(discover(midpoint, ['length-multiple']).relations.some((r) => !r.derived)).toBe(true);
  });
  it('lets a midpoint cover its exact collinearity support but preserves a longer line', () => {
    const kinds: GeometryRelationKind[] = ['midpoint', 'collinear'];
    expect(discover(midpoint, kinds).relations.map((r) => r.kind)).toEqual(['midpoint']);
    const expanded = discover(midpoint, kinds, { compressConsequences: false });
    expect(expanded.relations.some((r) => r.kind === 'collinear' && r.derived && r.derivedFrom!.some((id) => id.startsWith('midpoint:')))).toBe(true);
    expect(discover([...midpoint, point('Extra', 6.173, 0)], kinds).relations.some((r) => r.kind === 'collinear' && r.pointNames.length === 4)).toBe(true);
  });
  it.each([1.5, 2, 3])('finds the fixed ratio %s and validates equations in the length domain', (ratio) => {
    const points = [point('A', 0, 0), point('B', 1, 0), point('C', 7.239, 1.181), point('D', 7.239 + ratio, 1.181), point('Alias', 0, 0)];
    const result = discover(points, ['length-multiple']);
    expect(result.relations.some((r) => r.pointNames.includes('D') && r.pointNames.includes('B'))).toBe(true);
    for (const r of result.relations) {
      const equation = r.witnesses[0].equation!;
      expect(Math.abs(equationResidual(points, equation))).toBeLessThan(1e-5);
      expect(equation.terms.every(({ quantity }) => quantity.kind === 'length' && quantity.points[0] !== quantity.points[1])).toBe(true);
      expect(formatRelation(r)).toContain('dist(');
    }
  });
  it('uses similarity constraints to avoid repeating one constant scale on all corresponding sides', () => {
    const first = [point('A', 0, 0), point('B', 3.183, 0), point('C', 0.619, 2.139)];
    const second = first.map((p, i) => point(['D', 'E', 'F'][i], 20 + 2 * p.coordinates!.x, 10 - 2 * p.coordinates!.y));
    const kinds: GeometryRelationKind[] = ['similar-triangles', 'length-multiple'];
    const compressed = discover([...first, ...second], kinds); const expanded = discover([...first, ...second], kinds, { compressConsequences: false });
    expect(compressed.relations.some((r) => r.kind === 'similar-triangles')).toBe(true);
    expect(expanded.relations.filter((r) => r.kind === 'length-multiple').length).toBeGreaterThan(compressed.relations.filter((r) => r.kind === 'length-multiple').length);
    expect(expanded.relations.some((r) => r.kind === 'length-multiple' && r.derived && r.derivedFrom!.some((id) => id.startsWith('similar-triangles:')))).toBe(true);
  });
});

describe('dimensionless log length models', () => {
  it.each([1e-10, 1, 1e10])('expresses roots and negative powers consistently after a change of units %s', (scale) => {
    const points = rootLengths.map((p) => {
      const { x, y } = p.coordinates!; const angle = 0.3179;
      return point(p.name, scale * (10 + x * Math.cos(angle) - y * Math.sin(angle)), scale * (-9 + x * Math.sin(angle) + y * Math.cos(angle)));
    });
    const result = discover(points, ['length-space']);
    const model = result.relations.find((r) => r.id === 'length-space:A|B|C')?.lengthModel;
    expect(model).toBeDefined();
    expect(model!.constraintRank).toBeGreaterThan(0);
    expect(model!.generators).toHaveLength(2);
    expect(model!.members.some((m) => m.segment.join(',') === 'A,D' && m.denominator === 2 && m.ratio[0] === 2)).toBe(true);
    const byName = new Map(points.map((p) => [p.name, p.coordinates!]));
    const length = ([a, b]: [string, string]) => Math.hypot(byName.get(a)!.x - byName.get(b)!.x, byName.get(a)!.y - byName.get(b)!.y);
    for (const member of model!.members) {
      const actual = (length(member.segment) / length(model!.anchor)) ** member.denominator;
      const predicted = member.ratio[0] / member.ratio[1] * member.coefficients.reduce((product, coefficient, i) => product * (length(model!.generators[i]) / length(model!.anchor)) ** coefficient, 1);
      expect(Math.abs(actual - predicted) / Math.max(actual, predicted)).toBeLessThan(2e-6);
      const formatted = formatLengthMember(model!, member);
      if (formatted !== null) expect(formatted).toContain('dist(');
    }
  });
  it('compresses repeated lengths with model provenance but keeps them available when expanded', () => {
    const kinds: GeometryRelationKind[] = ['length-space', 'equal-lengths'];
    const result = discover(rootLengths, kinds); const expanded = discover(rootLengths, kinds, { compressConsequences: false });
    expect(result.relations.some((r) => r.lengthModel)).toBe(true);
    expect(expanded.relations.some((r) => r.kind === 'equal-lengths' && r.derived && r.derivedFrom!.some((id) => id.startsWith('length-space:')))).toBe(true);
    expect(expanded.relations.length).toBeGreaterThan(result.relations.length);
  });
  it('does not publish a length model that only restates the seed basis', () => {
    expect(discover(rootLengths.slice(0, 3), ['length-space']).relations).toEqual([]);
  });
});

describe('affine relations between ordinary angles', () => {
  it.each([
    ['angle-multiple', Math.PI / 6, Math.PI / 3],
    ['complementary-angles', Math.PI / 6, Math.PI / 3],
    ['supplementary-angles', Math.PI / 6, 5 * Math.PI / 6],
  ] as const)('finds %s without enabling equal-angle or generator outputs', (kind, a, b) => {
    const points = anglePair(a, b);
    const result = discover(points, [kind]);
    expect(result.relations.some((r) => r.pointNames.includes('A') && r.pointNames.includes('O') && r.pointNames.includes('P') && r.pointNames.includes('D'))).toBe(true);
    for (const r of result.relations) expect(Math.abs(equationResidual(points, r.witnesses[0].equation!))).toBeLessThan(4e-7);
    expect(result.relations.every((r) => r.kind === kind)).toBe(true);
  });
  it('does not interpret a supplementary angle as the same ordinary angle in a double-angle equation', () => {
    const result = discover(anglePair(Math.PI / 6, 5 * Math.PI / 6), ['angle-multiple']);
    expect(result.relations.some((r) => {
      const terms = r.witnesses[0].equation!.terms.map((t) => `${t.quantity.points[1]}:${[t.quantity.points[0], t.quantity.points[2]].sort().join(',')}`);
      return terms.includes('O:A,B') && terms.includes('P:C,D');
    })).toBe(false);
  });
  it('removes universal line-direction telescopes even in expanded mode', () => {
    const points = [point('A', 1, 0), point('O', 0, 0), point('C', -1, 0), point('B', 0.713, 0.983)];
    const result = discover(points, ['supplementary-angles'], { compressConsequences: false });
    expect(result.relations.some((r) => {
      const terms = r.witnesses[0].equation!.terms.map((t) => t.quantity.points.join(','));
      return terms.includes('A,O,B') && terms.includes('C,O,B');
    })).toBe(false);
  });
  it('keeps a numerical observation when its carrier representation is too uncertain to compress it', () => {
    const scene = buildGeometryScene(buildDependencyGraph(anglePair(Math.PI / 6, Math.PI / 3)), []);
    const space = new RationalRelationSpace();
    space.insert({ first: -2, second: 1 }, 'known-double-angle');
    const angles: AngleQuantity[] = [
      { value: Math.PI / 6, names: ['A', 'O', 'B'] as [string, string, string], indexes: [0, 1, 2], row: { first: 1 }, representationError: 2e-7 },
      { value: Math.PI / 3, names: ['C', 'P', 'D'] as [string, string, string], indexes: [3, 4, 5], row: { second: 1 }, representationError: 2e-7 },
    ];
    const options = { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: ['angle-multiple'] as GeometryRelationKind[] };
    const uncertain = detectAngleRelations(scene, angles.map((a) => scalarClass([a])), options, new DiscoveryBudget([]), space);
    expect(uncertain).toHaveLength(1);
    expect(uncertain[0].derived).toBe(false);
    expect(detectAngleRelations(scene, angles.map((a) => scalarClass([{ ...a, representationError: 0 }])), options, new DiscoveryBudget([]), space)).toEqual([]);
  });
});

describe('budgets on the additional families', () => {
  it('reports unavailable candidate work and stops at bounded output counts', () => {
    const result = discover(rootLengths, ['length-space', 'midpoint', 'length-multiple', 'angle-multiple'], { maxAngles: 0, maxComparisons: 0, maxModels: 0 });
    expect(result.relations).toEqual([]);
    expect(result.diagnostics.join(' ')).toContain('partial');
    const truncated = discover([...midpoint, point('C', 8, 0)], ['length-multiple'], { maxRelations: 1, compressConsequences: false });
    expect(truncated.relations).toHaveLength(1);
    expect(truncated.diagnostics.join(' ')).toContain('output limit');
  });
  it('retains a length summary when its result budget is one', () => {
    const result = discover(rootLengths, ['length-space', 'equal-lengths'], { maxRelations: 1, compressConsequences: false });
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].lengthModel).toBeDefined();
  });
});

