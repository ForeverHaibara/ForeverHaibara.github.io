import type { DirectionModel, LengthModel } from '../geometryTypes';
import { describeLengthConstraint, integerGcd as gcd, segmentKey } from '../algebra/lengthConstraint';
import type { Segment } from '../algebra/lengthConstraint';

interface Description { denominator: number; terms: Map<string, number>; }
interface DescriptionGroup { description: Description; members: Segment[]; }
export interface GeneratorPresentation { equations: string[]; identities: number; }
const add = (terms: Map<string, number>, id: string, coefficient: number) => {
  const next = (terms.get(id) ?? 0) + coefficient;
  if (next === 0) terms.delete(id); else terms.set(id, next);
};
const normalize = (denominator: number, terms: Map<string, number>): Description => {
  const divisor = [...terms.values()].reduce((divisor, coefficient) => gcd(divisor, coefficient), denominator);
  return { denominator: denominator / divisor, terms: new Map([...terms].map(([id, coefficient]) => [id, coefficient / divisor])) };
};
const descriptionKey = ({ denominator, terms }: Description) => JSON.stringify([denominator, [...terms].sort(([a], [b]) => a.localeCompare(b))]);
const identity = (target: Segment, description: Description) => description.terms.size === 1 && description.terms.get(segmentKey(target)) === description.denominator;
const distance = (segment: Segment) => `dist(${segment.join(', ')})`;
const line = (segment: Segment) => segment.join('·');
const chain = (items: string[], join: string, limit = 8) => {
  const text = items.slice(0, limit).join(join);
  return `${text}${items.length > limit ? ` … (+${items.length - limit})` : ''}`;
};
const power = (text: string, exponent: number) => `${text}${exponent === 1 ? '' : `^${exponent}`}`;
const combineGroups = <T extends { members: Array<unknown> }>(model: T, describe: (member: T['members'][number]) => { target: Segment; description: Description }) => {
  const groups = new Map<string, DescriptionGroup & { seen: Set<string> }>(); let identities = 0;
  for (const member of model.members) {
    const { target, description } = describe(member);
    if (identity(target, description)) { identities += 1; continue; }
    const key = descriptionKey(description);
    const group = groups.get(key) ?? { description, members: [], seen: new Set<string>() };
    if (!group.seen.has(segmentKey(target))) { group.members.push(target); group.seen.add(segmentKey(target)); }
    groups.set(key, group);
  }
  return { groups: [...groups.values()], identities };
};

const renderLengthGroup = ({ description, members }: DescriptionGroup): string => {
  const target = members.length === 1 ? distance(members[0]) : `(${chain(members.map(distance), ' = ')})`;
  const left = [power(target, description.denominator)]; const right: string[] = [];
  let numerator = 1; let denominator = 1;
  for (const [id, coefficient] of [...description.terms].sort(([a], [b]) => a.localeCompare(b))) {
    if (id.startsWith('@factor:')) {
      const prime = Number(id.slice('@factor:'.length));
      if (coefficient > 0) numerator *= prime ** coefficient; else denominator *= prime ** -coefficient;
    } else (coefficient > 0 ? right : left).push(power(distance(JSON.parse(id) as Segment), Math.abs(coefficient)));
  }
  if (denominator !== 1) left.unshift(String(denominator));
  if (numerator !== 1) right.unshift(String(numerator));
  return `${left.join(' × ')} = ${right.join(' × ') || '1'}`;
};
interface ProportionBucket { numerator: number; denominator: number; members: Segment[]; seen: Set<string>; }
interface ProportionFamily { base: string; buckets: Map<string, ProportionBucket>; }
const lengthProportion = (description: Description) => {
  const variables = [...description.terms].filter(([id]) => !id.startsWith('@factor:'));
  if (variables.length !== 1 || variables[0][1] !== description.denominator) return null;
  let numerator = 1; let denominator = 1;
  for (const [id, coefficient] of description.terms) if (id.startsWith('@factor:')) {
    if (coefficient % description.denominator !== 0) return null; // Keep irrational powers explicit.
    const prime = Number(id.slice('@factor:'.length)); const exponent = coefficient / description.denominator;
    if (exponent > 0) numerator *= prime ** exponent; else denominator *= prime ** -exponent;
  }
  return { base: variables[0][0], numerator, denominator };
};
const addProportion = (family: ProportionFamily, numerator: number, denominator: number, segment: Segment) => {
  const key = `${numerator}/${denominator}`;
  const bucket = family.buckets.get(key) ?? { numerator, denominator, members: [], seen: new Set<string>() };
  if (!bucket.seen.has(segmentKey(segment))) { bucket.members.push(segment); bucket.seen.add(segmentKey(segment)); }
  family.buckets.set(key, bucket);
};
const renderProportionFamily = (family: ProportionFamily, baseFirst = false): string => {
  addProportion(family, 1, 1, JSON.parse(family.base) as Segment);
  const baseBucket = family.buckets.get('1/1')!;
  if (baseFirst) baseBucket.members.sort((a, b) => Number(segmentKey(b) === family.base) - Number(segmentKey(a) === family.base));
  const buckets = [...family.buckets.values()].sort((a, b) => a.numerator / a.denominator - b.numerator / b.denominator);
  if (buckets.length === 1) return chain(buckets[0].members.map(distance), ' = ');
  const common = buckets.reduce((multiple, bucket) => multiple / gcd(multiple, bucket.numerator) * bucket.numerator, 1);
  const coefficients = buckets.map((bucket) => common * bucket.denominator / bucket.numerator);
  const divisor = coefficients.reduce(gcd);
  return buckets.map((bucket, i) => {
    const coefficient = coefficients[i] / divisor;
    const text = chain(bucket.members.map(distance), ' = ');
    return `${coefficient === 1 ? '' : `${coefficient} × `}${bucket.members.length > 1 ? `(${text})` : text}`;
  }).join(' = ');
};
const lengthCache = new WeakMap<LengthModel, GeneratorPresentation>();
/** Snapshots are immutable. Cancel the reference length algebraically, remove
 * identities and group members with the same exact rational description. */
export const presentLengthModel = (model: LengthModel): GeneratorPresentation => {
  const cached = lengthCache.get(model); if (cached) return cached;
  const families = new Map<string, ProportionFamily>();
  const groups = new Map<string, DescriptionGroup & { seen: Set<string> }>();
  const rows = new Map<string, () => string>(); let identities = 0;
  const identitySegments = new Set<string>();
  for (const member of model.members) {
    const normalized = describeLengthConstraint(model, member);
    if (!normalized) { identities += 1; identitySegments.add(segmentKey(member.segment)); continue; }
    const { target, description } = normalized;
    const proportion = lengthProportion(description);
    if (proportion) {
      const family = families.get(proportion.base) ?? { base: proportion.base, buckets: new Map<string, ProportionBucket>() };
      addProportion(family, proportion.numerator, proportion.denominator, target);
      families.set(proportion.base, family);
      if (!rows.has(`p:${proportion.base}`)) rows.set(`p:${proportion.base}`, () => renderProportionFamily(family, identitySegments.has(family.base)));
    } else {
      const key = descriptionKey(description);
      const group = groups.get(key) ?? { description, members: [], seen: new Set<string>() };
      if (!group.seen.has(segmentKey(target))) { group.members.push(target); group.seen.add(segmentKey(target)); }
      groups.set(key, group);
      if (!rows.has(`e:${key}`)) rows.set(`e:${key}`, () => renderLengthGroup(group));
    }
  }
  const result = { equations: [...rows.values()].map((render) => render()), identities };
  lengthCache.set(model, result); return result;
};
export const formatLengthMember = (model: LengthModel, member: LengthModel['members'][number]): string | null => {
  const normalized = describeLengthConstraint(model, member);
  return normalized ? renderLengthGroup({ description: normalized.description, members: [normalized.target] }) : null;
};

const directionDescription = (model: DirectionModel, member: DirectionModel['members'][number]): Description => {
  const terms = new Map<string, number>();
  add(terms, segmentKey(model.anchor), member.denominator - member.coefficients.reduce((sum, coefficient) => sum + coefficient, 0));
  member.coefficients.forEach((coefficient, i) => add(terms, segmentKey(model.generators[i]), coefficient));
  // The observed lift is retained in the model. For undirected-line display,
  // descriptions differing by an integer pi describe the same direction.
  add(terms, '@pi', ((member.constant % member.denominator) + member.denominator) % member.denominator);
  return normalize(member.denominator, terms);
};
const piFraction = (numerator: number, denominator: number) => {
  if (numerator === 0) return '0';
  const divisor = gcd(numerator, denominator); numerator /= divisor; denominator /= divisor;
  return `${numerator === 1 ? '' : numerator}π${denominator === 1 ? '' : `/${denominator}`}`;
};
const signedSum = (terms: Array<{ coefficient: number; text: string }>) => terms.filter((term) => term.coefficient !== 0).map((term, i) =>
  `${term.coefficient < 0 ? (i === 0 ? '− ' : ' − ') : (i === 0 ? '' : ' + ')}${Math.abs(term.coefficient) === 1 ? '' : `${Math.abs(term.coefficient)} × `}${term.text}`).join('') || '0';
export const formatLineAngle = (reference: Segment, target: Segment): string => `∠(${line(reference)}, ${line(target)})`;
const renderDirectionGroup = (model: DirectionModel, { description, members }: DescriptionGroup): string => {
  const variables = [...description.terms].filter(([id]) => id !== '@pi');
  const reference = variables.find(([id]) => id === segmentKey(model.anchor))
    ?? variables.slice().sort(([a, av], [b, bv]) => Math.abs(bv) - Math.abs(av) || a.localeCompare(b))[0];
  if (!reference) return ''; // A valid direction description has total weight one.
  const referenceLine = JSON.parse(reference[0]) as Segment;
  const others = variables.filter(([id]) => id !== reference[0]);
  const constant = description.terms.get('@pi') ?? 0;
  const family = chain(members.map(line), ' ∥ ');
  if (others.length === 0) {
    if (constant === 0) return chain([...members, referenceLine].map(line), ' ∥ ');
    if (2 * constant === description.denominator) return `${members.length > 1 ? `(${family})` : family} ⊥ ${line(referenceLine)}`;
    return `∠(${line(referenceLine)}, ${members.length > 1 ? `(${family})` : family}) = ${piFraction(constant, description.denominator)}`;
  }
  const left = `${description.denominator === 1 ? '' : `${description.denominator} × `}∠(${line(referenceLine)}, ${members.length > 1 ? `(${family})` : family})`;
  const positive = others.find(([, coefficient]) => coefficient > 0); const negative = others.find(([, coefficient]) => coefficient < 0);
  const right = others.length === 2 && positive && negative && positive[1] === -negative[1]
    ? [{ coefficient: positive[1], text: formatLineAngle(JSON.parse(negative[0]) as Segment, JSON.parse(positive[0]) as Segment) }]
    : others.map(([id, coefficient]) => ({ coefficient, text: formatLineAngle(referenceLine, JSON.parse(id) as Segment) }));
  if (constant !== 0) right.push({ coefficient: constant, text: 'π' });
  return `${left} = ${signedSum(right)}`;
};
const directionCache = new WeakMap<DirectionModel, GeneratorPresentation>();
export const presentDirectionModel = (model: DirectionModel): GeneratorPresentation => {
  const cached = directionCache.get(model); if (cached) return cached;
  const { groups, identities } = combineGroups(model, (member) => ({ target: member.line, description: directionDescription(model, member) }));
  const result = { equations: groups.map((group) => renderDirectionGroup(model, group)).filter(Boolean), identities };
  directionCache.set(model, result); return result;
};
