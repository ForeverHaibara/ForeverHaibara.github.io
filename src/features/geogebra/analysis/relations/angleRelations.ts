import { SCALAR_EPSILON } from '../numericPrecision';
import { combineExpressions, matchScalarTransform } from '../algebra/scalarSearch';
import type { RationalRelationSpace } from '../algebra/rationalSpace';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';
import { affineClassResidual } from '../algebra/scalarClasses';
import type { ScalarClass } from '../algebra/scalarClasses';
import { assessClusterRelation, classTerm } from './clusteredQuantities';
import type { RelationSupport } from '../geometryTypes';

export interface AngleQuantity { value: number; names: [string, string, string]; indexes: number[]; row: Record<string, number>; representationError: number; aliases?: [string[], string[]]; }
export const angleAliasSupport = (members: AngleQuantity[]): RelationSupport | undefined => {
  if (!members.some((member) => member.aliases?.some((names) => names.length > 1))) return undefined;
  const effective = [...new Set(members.flatMap((member) => member.names))].sort();
  const guards: Array<[string, string]> = members.flatMap((member) => (member.aliases ?? [[member.names[0]], [member.names[2]]]).flat()
    .map((endpoint): [string, string] => [member.names[1], endpoint]));
  return { effective, guards, assumptions: [...new Set(guards.flat())].filter((name) => !effective.includes(name)).sort(), frame: [],
    reason: 'Same-ray endpoints retained as aliases; value uses the represented angles rather than every endpoint substitution.' };
};
const PATTERNS = [
  { kind: 'angle-multiple', scale: 2, offset: 0, source: -2, target: 1, denominator: 1, pi: 0 },
  { kind: 'complementary-angles', scale: -1, offset: Math.PI / 2, source: 1, target: 1, denominator: 2, pi: 1 },
  { kind: 'supplementary-angles', scale: -1, offset: Math.PI, source: 1, target: 1, denominator: 1, pi: 1 },
] as const;

/** Ordinary angles in (0,pi); no modular identification of supplements. */
export const detectAngleRelations = (scene: GeometryScene, angles: ScalarClass<AngleQuantity>[], options: DiscoveryOptions, budget: DiscoveryBudget, space: RationalRelationSpace): RelationSeed[] => {
  const seeds: RelationSeed[] = [];
  const epsilon = SCALAR_EPSILON;
  for (const pattern of PATTERNS) {
    if (!options.enabledKinds.includes(pattern.kind)) continue;
    let count = 0;
    const order = new Map(angles.map((group, i) => [group, i]));
    for (const [source, target] of matchScalarTransform(angles, pattern.scale, pattern.offset, epsilon, budget, `${pattern.kind} comparisons`, options.maxComparisons, pattern.scale < 0)) {
      if (pattern.scale < 0 && order.get(source)! > order.get(target)!) continue;
      if (source === target && source.members.length < 2) continue;
      const residual = affineClassResidual(source, target, pattern.scale, pattern.offset);
      if (residual > epsilon) continue;
      const a = source.representative; const b = target.representative;
      const row = combineExpressions([[a.row, pattern.source * pattern.denominator], [b.row, pattern.target * pattern.denominator], [{ '@pi': -pattern.pi }, 1]]);
      const representationError = pattern.denominator * (Math.abs(pattern.source) * a.representationError + Math.abs(pattern.target) * b.representationError);
      const assessment = assessClusterRelation([source, target], row, residual * pattern.denominator + representationError + 1e-12, epsilon * pattern.denominator, space, epsilon);
      if (assessment.identity) continue;
      const { derived } = assessment;
      if (derived && options.compressConsequences) continue;
      if (count >= options.maxRelations) { budget.note(`${pattern.kind} output limit (${options.maxRelations}) reached; results are partial.`); break; }
      const points = new Set([...source.members, ...target.members].flatMap((member) => member.indexes));
      const key = `${pattern.kind}:${a.names.join('|')}:${b.names.join('|')}`;
      const quantity = (angle: AngleQuantity) => ({ kind: 'angle' as const, points: angle.names });
      seeds.push({ kind: pattern.kind, key, points, confidence: 0.98, derived, sourceIds: derived ? assessment.sourceIds : [],
        scoringNames: [...new Set([...source.members, ...target.members].flatMap((member) => member.names))],
        support: angleAliasSupport([...source.members, ...target.members]),
        witness: { points: [...points].map((i) => scene.points[i].name),
          angleAliases: [...new Set([source, target])].flatMap((group) => group.members.filter((member) => member.aliases?.some((names) => names.length > 1))
            .map((member) => ({ angle: member.names, endpoints: member.aliases! }))), equation: {
          terms: source === target ? [classTerm(source, pattern.target + pattern.source, quantity)]
            : [classTerm(target, pattern.target, quantity), classTerm(source, pattern.source, quantity)],
          pi: pattern.pi ? { numerator: pattern.pi, denominator: pattern.denominator } : undefined,
        } } });
      count += 1;
      if (!derived) assessment.register(key);
    }
  }
  return seeds;
};
