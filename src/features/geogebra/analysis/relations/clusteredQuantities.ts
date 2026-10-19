import type { ScalarClass } from '../algebra/scalarClasses';
import { combineExpressions } from '../algebra/scalarSearch';
import type { RationalRelationSpace } from '../algebra/rationalSpace';
import type { GeometricQuantity, QuantityEquation } from '../geometryTypes';

export interface ClusterQuantity {
  value: number;
  indexes: number[];
  row: Record<string, number>;
  representationError: number;
}

export const classTerm = <T>(group: ScalarClass<T>, coefficient: number, quantity: (member: T) => GeometricQuantity): QuantityEquation['terms'][number] => ({
  coefficient, quantity: quantity(group.representative),
  equivalents: group.members.length > 1 ? group.members.map(quantity) : undefined,
});

/** A clustered statement asserts the equality inside each class as well as
 * the relation between representatives. Derivability must cover both. */
export const assessClusterRelation = <T extends ClusterQuantity>(groups: ScalarClass<T>[], row: Record<string, number>, error: number,
  tolerance: number, space: RationalRelationSpace, membershipTolerance = tolerance) => {
  const equations = [{ row, error, tolerance }];
  for (const group of new Set(groups)) for (const member of group.members) {
    if (member === group.representative) continue;
    const representative = group.representative;
    equations.push({ row: combineExpressions([[member.row, 1], [representative.row, -1]]),
      error: Math.abs(member.value - representative.value) + member.representationError + representative.representationError + 1e-12, tolerance: membershipTolerance });
  }
  const nonzero = equations.filter((equation) => Object.keys(equation.row).length > 0);
  const reductions = nonzero.map((equation) => space.reduce(equation.row, equation.error));
  return {
    identity: nonzero.length === 0,
    derived: reductions.every((reduction, i) => reduction.redundant && reduction.error <= nonzero[i].tolerance),
    sourceIds: [...new Set(reductions.flatMap((reduction) => reduction.sources))],
    register: (source: string) => { for (const equation of nonzero) space.insert(equation.row, source, equation.error); },
  };
};
