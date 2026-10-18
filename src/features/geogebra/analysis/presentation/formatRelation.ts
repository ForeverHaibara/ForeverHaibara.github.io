import type { GeometryRelation, RelationWitness } from '../geometryTypes';
import { relationLabel } from '../relations/catalog';

const names = (line: string[]) => line.join('·');
const family = (lines: string[][]) => lines.map(names).join(' ∥ ');
const summary = (items: string[], total = items.length): string => `${items.slice(0, 8).join(' = ')}${total > 8 ? ` … (+${total - 8})` : ''}`;

export const formatRelation = (relation: GeometryRelation, witness: RelationWitness = relation.witnesses[0]): string => {
  if (relation.model) return `${relation.model.members.length} lines · ${relation.model.generators.length} generators + π`;
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
