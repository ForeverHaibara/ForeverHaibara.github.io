import type { GeometryPredicate, Rational, ReasoningProblem, Segment } from './types';
import { formatProductEquation } from '../../geometry/vectorProducts';

export const formatPredicate = (predicate: GeometryPredicate, objects: ReasoningProblem['objects']): string => {
  const names = new Map(objects.map((object) => [object.id, object.name]));
  const name = (id: string) => names.get(id) ?? id;
  if (predicate.kind === 'vector-product-equation') return formatProductEquation(predicate.equation, name);
  const segment = (points: Segment) => `(${points.map(name).join(', ')})`;
  const rational = (value: Rational) => value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
  if (predicate.kind === 'collinear' || predicate.kind === 'concyclic') return `${predicate.points.map(name).join(', ')} ${predicate.kind}`;
  if (predicate.kind === 'coincident') return `${predicate.points.map(name).join(' = ')}`;
  if ('segments' in predicate) return predicate.segments.map(segment).join({ parallel: ' ∥ ', perpendicular: ' ⊥ ', 'equal-length': ' = ' }[predicate.kind]);
  if (predicate.kind === 'midpoint') return `${name(predicate.point)} is the midpoint of ${segment(predicate.segment)}`;
  if ('pi' in predicate) return `${predicate.terms.map((term) => `${term.coefficient} × ${predicate.kind === 'directed-angle-equation' ? '∡' : '∠'}(${term.angle.map(name).join(', ')})`).join(' + ')} = ${rational(predicate.pi)}π${predicate.kind === 'directed-angle-equation' ? ' (mod π)' : ' (ordinary)'}`;
  if ('terms' in predicate) {
    if (predicate.kind === 'length-product') return `${predicate.terms.filter((term) => term.coefficient).map((term) => `dist${segment(term.segment)}^(${term.coefficient})`).join(' × ')} = ${rational(predicate.constant)}`;
    return `${predicate.terms.filter((term) => term.coefficient).map((term) => `${term.coefficient} × ${predicate.kind === 'direction-equation' ? 'dir' : 'dist'}${segment(term.segment)}`).join(' + ')} = ${rational(predicate.constant)}${predicate.kind === 'direction-equation' ? 'π (mod π)' : ''}`;
  }
  return '';
};
