import type { GeometricQuantity, GeometryRelation, QuantityEquation, RelationWitness } from '../geometryTypes';
import { relationLabel } from '../relations/catalog';
import { presentDirectionModel, presentLengthModel } from './generatorPresentation';
import { formatProductEquation } from '../../geometry/vectorProducts';
export { formatLengthMember } from './generatorPresentation';

const names = (line: string[]) => line.join('·');
const family = (lines: string[][]) => lines.map(names).join(' ∥ ');
const summary = (items: string[], total = items.length): string => `${items.slice(0, 8).join(' = ')}${total > 8 ? ` … (+${total - 8})` : ''}`;
const generatorTitle = (objects: string[], relations: number, dimension: number): string => `${objects.join(', ')} · ${relations} rel · dim ${dimension}`;
export const formatQuantity = (quantity: GeometricQuantity): string => quantity.kind === 'length'
  ? `dist(${quantity.points.join(', ')})` : `∠(${quantity.points.join(', ')})`;
export const formatQuantityGroup = (quantities: GeometricQuantity[], limit = 8, directed = false): string => {
  const unique = new Map(quantities.map((quantity) => [JSON.stringify(quantity.kind === 'length'
    ? ['length', [...quantity.points].sort()] : directed ? ['directed', quantity.points] : ['angle', quantity.points[1], [quantity.points[0], quantity.points[2]].sort()]), quantity]));
  const members = [...unique.values()];
  const text = `${members.slice(0, limit).map((quantity) => directed && quantity.kind === 'angle' ? `∡(${quantity.points.join(', ')})` : formatQuantity(quantity)).join(' = ')}${members.length > limit ? ` … (+${members.length - limit})` : ''}`;
  return members.length > 1 ? `(${text})` : text;
};
export const formatEquation = (equation: QuantityEquation): string => {
  const side = (sign: number) => equation.terms.filter((term) => term.coefficient * sign > 0)
    .map((term) => `${Math.abs(term.coefficient) === 1 ? '' : `${Math.abs(term.coefficient)} × `}${formatQuantityGroup(term.equivalents ?? [term.quantity], 8, equation.angleSemantics === 'directed-mod-pi')}`);
  const right = side(-1);
  if (equation.pi?.numerator) right.push(`${equation.pi.numerator === 1 ? '' : equation.pi.numerator}π${equation.pi.denominator === 1 ? '' : `/${equation.pi.denominator}`}`);
  return `${side(1).join(' + ') || '0'} = ${right.join(' + ') || '0'}${equation.angleSemantics === 'directed-mod-pi' ? ' (mod π)' : ''}`;
};

export const formatRelation = (relation: GeometryRelation, witness: RelationWitness = relation.witnesses[0]): string => {
  if (relation.family) {
    const { instances } = relation.family;
    const binding = instances[0].binding;
    const list = `{${instances.slice(0, 8).map((instance) => instance.binding).join(', ')}${instances.length > 8 ? ', …' : ''}}`;
    const name = (value: string) => value === binding ? list : value;
    const pair = (points: [string, string]) => points.map(name) as [string, string];
    const triple = (points: [string, string, string]) => points.map(name) as [string, string, string];
    const base = instances[0].witness;
    const mapped: RelationWitness = { ...base, points: base.points.map(name), triangles: base.triangles?.map(triple),
      segments: base.segments?.map(pair), angles: base.angles?.map(triple), equation: base.equation && { ...base.equation,
        terms: base.equation.terms.map((term) => ({ ...term, equivalents: undefined, quantity: term.quantity.kind === 'length'
          ? { kind: 'length', points: pair(term.quantity.points) } : { kind: 'angle', points: triple(term.quantity.points) } })) } };
    return `${formatRelation({ ...relation, family: undefined }, mapped)} · ${instances.length} observations`;
  }
  if (relation.model) return generatorTitle(relation.support?.effective ?? relation.pointNames, presentDirectionModel(relation.model).equations.length, relation.model.generators.length);
  if (relation.lengthModel) return generatorTitle(relation.support?.effective ?? relation.pointNames, presentLengthModel(relation.lengthModel).equations.length, relation.lengthModel.generators.length);
  if (witness.midpoint) return `${witness.midpoint.point} is the midpoint of (${witness.midpoint.segment.join(', ')})`;
  if (witness.productEquation) return formatProductEquation(witness.productEquation);
  if (witness.equation) return formatEquation(witness.equation);
  if (witness.triangles) return witness.triangles.slice(0, 8).map((triangle) => `△(${names(triangle)})`).join(relation.kind === 'congruent-triangles' ? ' ≅ ' : ' ∼ ');
  if (witness.angles) return summary(witness.angles.map((angle) => `∠(${names(angle)})`));
  if (witness.segments) return summary(witness.segments.map(([a, b]) => `dist(${a}, ${b})`));
  if (relation.kind === 'coincident-points') return `${summary(relation.pointNames)} (numerically coincident)`;
  if (relation.kind === 'perpendicular' && witness.lineFamilies?.length === 2) return `(${family(witness.lineFamilies[0])}) ⊥ (${family(witness.lineFamilies[1])})`;
  if (relation.kind === 'parallel' && witness.lineFamilies?.length === 1) return family(witness.lineFamilies[0]);
  if (relation.kind === 'collinear') return `${witness.lineFamilies?.[0]?.[0]?.join(', ') ?? relation.pointNames.join(', ')} collinear`;
  if (relation.kind === 'concyclic') return `${witness.points.join(', ')} concyclic`;
  return relationLabel(relation.kind);
};

export const displayScore = (score: number): number => Math.round(Math.max(0, Math.min(100, score)));
export const scoreColors = (score: number): { backgroundColor: string; color: string } => {
  const palette = [['#eff6ff', '#1e40af'], ['#dbeafe', '#1e40af'], ['#bfdbfe', '#1e3a8a'], ['#2563eb', '#ffffff'], ['#1e40af', '#ffffff']];
  const [backgroundColor, color] = palette[Math.min(4, Math.floor(displayScore(score) / 20))];
  return { backgroundColor, color };
};
