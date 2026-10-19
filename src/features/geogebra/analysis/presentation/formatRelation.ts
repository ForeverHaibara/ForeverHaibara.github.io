import type { GeometricQuantity, GeometryRelation, LengthModel, QuantityEquation, RelationWitness } from '../geometryTypes';
import { relationLabel } from '../relations/catalog';

const names = (line: string[]) => line.join('·');
const family = (lines: string[][]) => lines.map(names).join(' ∥ ');
const summary = (items: string[], total = items.length): string => `${items.slice(0, 8).join(' = ')}${total > 8 ? ` … (+${total - 8})` : ''}`;
export const formatQuantity = (quantity: GeometricQuantity): string => quantity.kind === 'length'
  ? `dist(${quantity.points.join(', ')})` : `∠(${quantity.points.join(', ')})`;
export const formatEquation = (equation: QuantityEquation): string => {
  const side = (sign: number) => equation.terms.filter((term) => term.coefficient * sign > 0)
    .map((term) => `${Math.abs(term.coefficient) === 1 ? '' : `${Math.abs(term.coefficient)} × `}${formatQuantity(term.quantity)}`);
  const right = side(-1);
  if (equation.pi) right.push(`${equation.pi.numerator === 1 ? '' : equation.pi.numerator}π${equation.pi.denominator === 1 ? '' : `/${equation.pi.denominator}`}`);
  return `${side(1).join(' + ') || '0'} = ${right.join(' + ') || '0'}`;
};
export const formatLengthMember = (model: LengthModel, member: LengthModel['members'][number]): string => {
  const ratio = (segment: [string, string]) => `(dist(${segment.join(', ')}) / dist(${model.anchor.join(', ')}))`;
  const factors = member.coefficients.flatMap((coefficient, i) => coefficient === 0 ? [] : [`${ratio(model.generators[i])}${coefficient === 1 ? '' : `^(${coefficient})`}`]);
  if (member.ratio[0] !== member.ratio[1]) factors.unshift(member.ratio[1] === 1 ? String(member.ratio[0]) : `(${member.ratio[0]}/${member.ratio[1]})`);
  return `${ratio(member.segment)}${member.denominator === 1 ? '' : `^${member.denominator}`} = ${factors.join(' × ') || '1'}`;
};

export const formatRelation = (relation: GeometryRelation, witness: RelationWitness = relation.witnesses[0]): string => {
  if (relation.model) return `${relation.model.members.length} lines · ${relation.model.generators.length} generators + π`;
  if (relation.lengthModel) return `${relation.lengthModel.members.length} lengths · ${relation.lengthModel.generators.length} ratio generators`;
  if (witness.midpoint) return `${witness.midpoint.point} is the midpoint of (${witness.midpoint.segment.join(', ')})`;
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
