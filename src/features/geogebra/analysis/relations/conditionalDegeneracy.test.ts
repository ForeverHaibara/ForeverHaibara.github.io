import { describe, expect, it } from 'vitest';
import { buildDependencyGraph } from '../constructionGraph';
import { detectGeometryRelations } from '../geometryRelations';
import type { ConstructionObjectInput } from '../graphTypes';
import type { GeometryRelationKind, LengthModel } from '../geometryTypes';
import { normalizeLengthConstraint } from '../algebra/lengthConstraint';
import { formatLengthMember } from '../presentation/generatorPresentation';
import { formatRelation } from '../presentation/formatRelation';
import { buildGeometryScene } from '../scene/geometryScene';
import { buildRayClasses } from '../scene/rays';
import { buildDirectionSpaces } from './directionSpaces';
import { DEFAULT_DISCOVERY_OPTIONS, DiscoveryBudget } from './catalog';
import { detectMetricRelations } from './metricRelations';
import { analyzeSharedComparisons } from './conditionalComparisons';
import { groupRoleFamilies } from './roleFamilies';
import type { RelationSeed } from './relationSeed';

const point = (name: string, x: number, y: number, commandString = ''): ConstructionObjectInput => ({ name, objectType: 'point', commandString, coordinates: { x, y } });
const options = (enabledKinds: GeometryRelationKind[]) => ({ ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds });
const discover = (points: ConstructionObjectInput[], kinds: GeometryRelationKind[]) => detectGeometryRelations(buildDependencyGraph(points), 0, options(kinds));

describe('ray quotient before ordinary angle candidates', () => {
  it('identifies same rays, preserves opposite rays and works with collinear output disabled', () => {
    const scene = buildGeometryScene(buildDependencyGraph([point('A', -2, 0), point('B', -1, 0), point('C', 0, 0), point('E', 1, 0), point('D', 0, 2)]), []);
    const budget = new DiscoveryBudget([]);
    const directions = buildDirectionSpaces(scene, [], options(['equal-angles']), budget);
    const index = scene.points.findIndex((p) => p.name === 'C');
    const rays = buildRayClasses(scene, directions.bySegment)[index].map((ray) => ray.endpoints.map((i) => scene.points[i].name).sort());
    expect(rays).toContainEqual(['A', 'B']);
    expect(rays).toContainEqual(['E']);
    expect(rays).toContainEqual(['D']);
    expect(directions.bySegment.values().next().value?.incidenceSource).toBeTruthy();
  });
  it('does not publish same-ray or vertical-angle identities as fresh equal-angle information', () => {
    const points = [point('A', -2, 0), point('B', -1, 0), point('C', 0, 0), point('D', 0.371, 1.413)];
    const result = discover(points, ['equal-angles']);
    expect(result.relations).toHaveLength(0);
  });
  it('still compares the retained angle with another construction', () => {
    const theta = Math.atan2(2, 0.7);
    const points = [point('A', 1, 0), point('B', 2, 0), point('C', 0, 0), point('D', 0.7, 2),
      point('U', 11, 5), point('V', 10, 5), point('W', 10 + 1.3 * Math.cos(theta), 5 + 1.3 * Math.sin(theta))];
    const result = discover(points, ['equal-angles']);
    expect(result.relations.some((relation) => relation.witnesses[0].angles?.some((angle) => angle[1] === 'C')
      && relation.witnesses[0].angles?.some((angle) => angle[1] === 'V'))).toBe(true);
    expect(result.relations.some((relation) => relation.witnesses[0].angleAliases?.some((alias) => alias.endpoints.some((names) => names.includes('A') && names.includes('B'))))).toBe(true);
    expect(result.relations.some((relation) => relation.support?.assumptions?.includes('B'))).toBe(true);
  });
  it('reduces evaluation count on a collinear star without spending an identity on every endpoint triple', () => {
    const points = Array.from({ length: 18 }, (_, i) => point(`P${String(i).padStart(2, '0')}`, i, 0));
    points.push(point('Q', 0.31, 2.17));
    const scene = buildGeometryScene(buildDependencyGraph(points), []); const budget = new DiscoveryBudget([]);
    detectMetricRelations(scene, [], options(['equal-angles']), budget);
    expect(budget.used('Angle candidates')).toBeLessThan(400);
    expect(budget.used('Angle candidates')).toBeGreaterThan(0);
  });
  it('does not identify supplements with equal angles when C lies between the endpoints', () => {
    const points = [point('A', -1, 0), point('B', 1, 0), point('C', 0, 0), point('D', 0.3, 2)];
    const result = discover(points, ['equal-angles', 'supplementary-angles']);
    // The supplement is a carrier identity, so it need not produce a card.
    // Its two ordinary angles must nevertheless remain distinct quantities.
    expect(result.relations.filter((relation) => relation.kind === 'equal-angles').some((relation) => {
      const angles = relation.witnesses[0].angles ?? [];
      return angles.filter((angle) => angle[1] === 'C').length > 1;
    })).toBe(false);
  });
});

describe('guarded normalized generator constraints', () => {
  const model: LengthModel = { anchor: ['B', 'D'], generators: [['B', 'C']], constraintRank: 1, members: [
    { segment: ['A', 'B'], denominator: 1, coefficients: [1], ratio: [1, 1], residual: 0 },
  ] };
  it('cancels a reference denominator but retains its nonzero guard', () => {
    const normalized = normalizeLengthConstraint(model, model.members[0]);
    expect(new Set(normalized.segments.flat())).toEqual(new Set(['A', 'B', 'C']));
    expect(normalized.guards).toContainEqual(['B', 'D']);
    expect(formatLengthMember(model, model.members[0])).toBe('dist(A, B) = dist(B, C)');
  });
  it('cancels a target occurring on both sides before rendering and identifying support', () => {
    const self: LengthModel = { anchor: ['X', 'Y'], generators: [['A', 'B'], ['B', 'C']], constraintRank: 1, members: [
      { segment: ['A', 'B'], denominator: 2, coefficients: [1, 1], ratio: [1, 1], residual: 0 },
    ] };
    expect(formatLengthMember(self, self.members[0])).toBe('dist(A, B) = dist(B, C)');
    expect(normalizeLengthConstraint(self, self.members[0]).segments.flat()).not.toContain('X');
  });
  it('keeps a genuinely uncancelled denominator in support', () => {
    const member = { ...model.members[0], coefficients: [-1] };
    expect(normalizeLengthConstraint(model, member).segments.flat()).toContain('D');
  });
  it('does not let an unrelated reference point force the model value to 100', () => {
    const graph = buildDependencyGraph([point('A', 0, 0), point('B', 2, 0), point('C', 0.43, 1.7, 'f(B)'), point('L', 1.215, 0.85, 'g(B,C)')]);
    const result = detectGeometryRelations(graph, 0, { ...options(['length-space']), maxModels: 1 });
    const relation = result.relations.find((item) => item.lengthModel)!;
    expect(relation).toBeDefined();
    expect(relation.support?.effective).toEqual(['B', 'C', 'L']);
    expect(relation.support?.frame).toContain('A');
    expect(relation.pointNames).toContain('A');
    expect(relation.nonTriviality).toBeLessThan(30);
    expect(formatRelation(relation).startsWith('B, C, L ·')).toBe(true);
  });
});

const congruence = (binding: string): RelationSeed => ({ key: `congruence:${binding}`, kind: 'congruent-triangles', confidence: 0.98,
  points: new Set([0, 1, 2, 3]), witness: { points: ['A', 'B', 'C', binding], triangles: [['A', 'B', binding], ['C', 'B', binding]] } });

describe('shared comparator conditions and finite role families', () => {
  const scene = buildGeometryScene(buildDependencyGraph([point('A', -1, 0), point('B', 0, 0), point('C', 1, 0), point('D', 0, 2)]), []);
  it('preserves the perpendicular-bisector condition instead of declaring D arbitrary', () => {
    const [seed] = analyzeSharedComparisons(scene, [congruence('D')]);
    expect(seed.witness.conditions).toHaveLength(2);
    expect(seed.witness.conditions?.filter((condition) => condition.background)).toHaveLength(1);
    expect(seed.scoringGroups).toEqual([['A', 'B', 'C'], ['A', 'C', 'D']]);
    expect(seed.witness.conditions?.find((condition) => !condition.background)?.locus).toEqual({ kind: 'perpendicular-bisector', point: 'D', segment: ['A', 'C'] });
    expect(seed.witness.conditions?.flatMap((condition) => condition.sourceIds)).not.toContain(seed.key);
  });
  it('finds shared SSS structure independently of command syntax and UI midpoint output', () => {
    const result = discover([point('A', -1, 0), point('B', 0, 0), point('C', 1, 0), point('D', 0, 2)], ['congruent-triangles']);
    const relation = result.relations.find((item) => item.witnesses[0].conditions?.some((condition) => condition.background));
    expect(relation?.support?.effective).toEqual(['A', 'B', 'C', 'D']);
    expect(relation?.pointNames).toContain('B');
    expect(discover([point('A', -1, 0), point('B', 0, 0), point('C', 1, 0), point('D', 0.2, 2)], ['congruent-triangles']).relations).toHaveLength(0);
  });
  it('retains both new conditions when no independent midpoint background is present', () => {
    const other = buildGeometryScene(buildDependencyGraph([point('A', -1, 0), point('B', 0, 2), point('C', 1, 0), point('D', 0, 3)]), []);
    const [seed] = analyzeSharedComparisons(other, [congruence('D')]);
    expect(seed.witness.conditions?.every((condition) => !condition.background)).toBe(true);
    expect(seed.scoringGroups).toHaveLength(2);
  });
  it('does not lose a valuable newly observed core by treating it as previously familiar', () => {
    const result = discover([point('A', -1, 0, 'f(C)'), point('B', 0, 0), point('C', 1, 0), point('D', 0, 2, 'g(A,C)')], ['congruent-triangles']);
    const relation = result.relations.find((item) => item.witnesses[0].conditions?.some((condition) => condition.background))!;
    expect(relation).toBeDefined();
    expect(relation.nonTriviality).toBe(100);
    expect(relation.metric.pointCount).toBe(3);
  });
  it('packs only verified one-role bindings, retaining all primitive conditions and source IDs', () => {
    const seeds = ['D', 'E', 'F'].map(congruence);
    const grouped = groupRoleFamilies(seeds, new DiscoveryBudget([]));
    expect(grouped).toHaveLength(1);
    expect(grouped[0].family?.fixed).toEqual(['A', 'B', 'C']);
    expect(grouped[0].family?.instances.map((instance) => instance.binding)).toEqual(['D', 'E', 'F']);
    expect(grouped[0].scoringGroups).toHaveLength(3);
    expect(grouped[0].family?.instances.map((instance) => instance.sourceId)).toEqual(seeds.map((seed) => seed.key));
  });
  it('does not fabricate crossed bindings from instances with two varying roles', () => {
    const seeds = ['D', 'E', 'F'].map((name, i) => ({ ...congruence(name), witness: {
      points: ['A', 'C', name, `Q${i}`], triangles: [['A', `Q${i}`, name], ['C', `Q${i}`, name]] as Array<[string, string, string]>,
    } }));
    expect(groupRoleFamilies(seeds, new DiscoveryBudget([]))).toEqual(seeds);
  });
  it('does not group different correspondences by their unordered point sets', () => {
    const seeds = ['D', 'E', 'F'].map((binding, i) => ({ ...congruence(binding), witness: { points: ['A', 'B', 'C', binding], triangles: [
      ['A', 'B', binding], [['C', 'B', binding], ['B', 'C', binding], [binding, 'C', 'B']][i],
    ] as Array<[string, string, string]> } }));
    expect(groupRoleFamilies(seeds, new DiscoveryBudget([]))).toHaveLength(3);
  });
  it('publishes a finite family with its shared core, all witnesses and explicit presentation', () => {
    const result = discover([point('A', -1, 0), point('B', 0, 0), point('C', 1, 0), point('D', 0, 2), point('E', 0, 3), point('F', 0, 5)], ['congruent-triangles']);
    const relation = result.relations.find((item) => item.family)!;
    expect(relation).toBeDefined();
    expect(relation.family!.instances).toHaveLength(3);
    expect(relation.family!.commonConditions.length).toBeGreaterThan(0);
    expect(relation.pointNames).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(formatRelation(relation)).toContain('3 observations');
    expect(formatRelation(relation)).toContain('{');
    expect(formatRelation(relation)).not.toContain('any');
  });
  it('does not degrade an ordinary congruence of two disjoint triangles into SSS cards', () => {
    const result = discover([point('A', 0, 0), point('B', 3, 0), point('C', 0.7, 2), point('D', 10, 5), point('E', 13, 5), point('F', 10.7, 7)], ['congruent-triangles']);
    const relation = result.relations.find((item) => item.pointNames.length === 6)!;
    expect(relation).toBeDefined();
    expect(relation.witnesses[0].conditions).toBeUndefined();
    expect(formatRelation(relation)).toContain(' ≅ ');
  });
  it('bounds template work as well as projection count for large pre-grouped statements', () => {
    const seed: RelationSeed = { key: 'large', kind: 'equal-angles', confidence: 0.98, points: new Set(), witness: {
      points: ['A', 'B', 'C'], angles: Array.from({ length: 100 }, (_, i) => ['A', 'B', `C${i}`]),
    } };
    const notes: string[] = []; const budget = new DiscoveryBudget(notes);
    expect(groupRoleFamilies([seed], budget)).toEqual([seed]);
    expect(budget.used('Role projections')).toBe(0);
    expect(notes.some((note) => note.includes('template size limit'))).toBe(true);
  });
});
