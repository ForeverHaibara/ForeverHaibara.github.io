import { SCALAR_EPSILON } from '../numericPrecision';
import { RationalRelationSpace } from '../algebra/rationalSpace';
import { combineExpressions, matchScalarTransform, RationalCombinationIndex } from '../algebra/scalarSearch';
import { positiveLengthPairs, segmentId } from '../quantities/lengths';
import type { PositiveLength } from '../quantities/lengths';
import { orientedDoubleArea } from '../quantities/vector';
import type { GeometryScene } from '../scene/geometryScene';
import type { DiscoveryBudget, DiscoveryOptions } from './catalog';
import type { RelationSeed } from './relationSeed';
import type { LengthModel } from '../geometryTypes';
import { balancedTriples } from '../quantities/candidates';
import { affineClassResidual, groupScalarClasses } from '../algebra/scalarClasses';
import { assessClusterRelation, classTerm } from './clusteredQuantities';
import { normalizeLengthConstraint, segmentKey } from '../algebra/lengthConstraint';

const EPSILON = SCALAR_EPSILON;
const RATIOS = [
  { ratio: [1, 1], two: 0, three: 0 },
  { ratio: [3, 2], two: -1, three: 1 },
  { ratio: [2, 1], two: 1, three: 0 },
  { ratio: [3, 1], two: 0, three: 1 },
  { ratio: [2, 3], two: 1, three: -1 },
  { ratio: [1, 2], two: -1, three: 0 },
  { ratio: [1, 3], two: 0, three: -1 },
].map((entry) => ({ ...entry, ratio: entry.ratio as [number, number], value: Math.log(entry.ratio[0] / entry.ratio[1]), cost: Math.abs(entry.two) + Math.abs(entry.three) }));
export const createLengthRelationSpace = () => new RationalRelationSpace(new Set(['@log2', '@log3']));

export const detectLengthRelations = (scene: GeometryScene, options: DiscoveryOptions, budget: DiscoveryBudget, space: RationalRelationSpace): RelationSeed[] => {
  const enabled = new Set(options.enabledKinds);
  if (!['equal-lengths', 'midpoint', 'length-multiple', 'length-space'].some((kind) => enabled.has(kind as RelationSeed['kind']))) return [];
  const quantities = positiveLengthPairs(scene).map((quantity) => ({ ...quantity,
    indexes: [quantity.left, quantity.right], row: { [quantity.id]: 1 }, representationError: 0 }));
  const byId = new Map(quantities.map((quantity) => [quantity.id, quantity]));
  const names = (q: PositiveLength): [string, string] => [scene.points[q.left].name, scene.points[q.right].name];
  const seeds: RelationSeed[] = [];

  if (enabled.has('midpoint')) {
    const epsilon = scene.tolerance.distance;
    const cells = new Map<string, number[]>();
    scene.points.forEach((point, i) => {
      const key = `${Math.floor(point.coordinates.x / epsilon)}:${Math.floor(point.coordinates.y / epsilon)}`;
      const cell = cells.get(key) ?? []; cell.push(i); cells.set(key, cell);
    });
    outer: for (const q of quantities) {
      if (!budget.take('Midpoint lookups', options.maxComparisons)) break;
      const a = scene.points[q.left].coordinates; const b = scene.points[q.right].coordinates;
      const x = (a.x + b.x) / 2; const y = (a.y + b.y) / 2;
      const cellX = Math.floor(x / epsilon); const cellY = Math.floor(y / epsilon);
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (const m of cells.get(`${cellX + dx}:${cellY + dy}`) ?? []) {
        if (!budget.take('Midpoint comparisons', options.maxComparisons)) break outer;
        if (m === q.left || m === q.right) continue;
        const p = scene.points[m].coordinates;
        if (Math.hypot(p.x - x, p.y - y) > epsilon) continue;
        const am = byId.get(segmentId(q.left, m)); const bm = byId.get(segmentId(q.right, m));
        if (!am || !bm || Math.abs(Math.log(am.length / bm.length)) > EPSILON
          || Math.abs(Math.log(q.length / (2 * am.length))) > EPSILON) continue;
        const segment = names(q); const point = scene.points[m].name;
        if (seeds.length >= options.maxRelations) { budget.note(`Midpoint output limit (${options.maxRelations}) reached; results are partial.`); break outer; }
        const key = `midpoint:${point}:${[...segment].sort().join('|')}`;
        const points = new Set([q.left, q.right, m]);
        seeds.push({ kind: 'midpoint', key, points, confidence: 0.98,
          witness: { points: [...points].map((i) => scene.points[i].name), midpoint: { point, segment } } });
        space.insert(combineExpressions([[{ [am.id]: 1 }, 1], [{ [bm.id]: 1 }, -1]]), key, Math.abs(am.value - bm.value) + 1e-12);
        space.insert({ [q.id]: 1, [am.id]: -1, '@log2': -1 }, key, Math.abs(q.value - am.value - Math.LN2) + 1e-12);
      }
    }
  }

  if (enabled.has('length-space')) seeds.push(...buildLengthSpaces(scene, quantities, options, budget, space));
  if (!enabled.has('equal-lengths') && !enabled.has('length-multiple')) return seeds;
  // Use equivalence representatives for the following offset search rather
  // than forming all ratios between every equal-length witness.
  const groups = groupScalarClasses(quantities.map((q) => [q]), EPSILON, budget, 'Length comparisons', options.maxComparisons);
  if (enabled.has('equal-lengths')) for (const { members: group } of groups) {
    if (group.length < 2) continue;
    const keys = group.map((q) => space.reduce({ [q.id]: 1 }));
    const derived = keys.every((key) => key.key === keys[0].key && key.error <= EPSILON) && keys.some((key) => key.sources.length > 0);
    const segments = group.map(names); const points = new Set(group.flatMap((q) => [q.left, q.right]));
    const key = `equal-lengths:${segments.map((segment) => segment.join('|')).sort().join(';')}`;
    if (!derived || !options.compressConsequences) seeds.push({ kind: 'equal-lengths', key, points, confidence: 0.98,
      witness: { points: [...points].map((i) => scene.points[i].name), segments }, derived,
      sourceIds: derived ? [...new Set(keys.flatMap((item) => item.sources))] : [] });
    // A bounded-diameter numerical group supplies a star, not an equality
    // inferred by transitively closing a near-equality chain.
    if (!derived) for (const q of group.slice(1)) space.insert({ [q.id]: 1, [group[0].id]: -1 }, key, Math.abs(q.value - group[0].value));
  }

  if (enabled.has('length-multiple')) {
    let count = 0;
    outer: for (const ratio of RATIOS.slice(1, 4)) for (const [shortClass, longClass] of matchScalarTransform(groups, 1, ratio.value, EPSILON, budget, 'Length ratio comparisons', options.maxComparisons)) {
      const residual = affineClassResidual(shortClass, longClass, 1, ratio.value);
      if (residual > EPSILON) continue;
      const short = shortClass.representative; const long = longClass.representative;
      const [p, q] = ratio.ratio;
      if (Math.abs(q * long.length - p * short.length) > EPSILON * Math.max(q * long.length, p * short.length)) continue;
      const row = { [long.id]: 1, [short.id]: -1, '@log2': -ratio.two, '@log3': -ratio.three };
      const assessment = assessClusterRelation([shortClass, longClass], row, residual + 1e-12, EPSILON, space);
      if (assessment.identity) continue;
      const { derived } = assessment;
      if (derived && options.compressConsequences) continue;
      if (count >= options.maxRelations) { budget.note(`Length ratio output limit (${options.maxRelations}) reached; results are partial.`); break outer; }
      const key = `length-multiple:${long.id}:${short.id}:${p}/${q}`;
      const points = new Set([...shortClass.members, ...longClass.members].flatMap((member) => member.indexes));
      const quantity = (member: PositiveLength) => ({ kind: 'length' as const, points: names(member) });
      seeds.push({ kind: 'length-multiple', key, points, confidence: 0.98, derived, sourceIds: derived ? assessment.sourceIds : [],
        witness: { points: [...points].map((i) => scene.points[i].name), equation: { terms: [
          classTerm(longClass, q, quantity), classTerm(shortClass, -p, quantity),
        ] } } });
      count += 1;
      if (!derived) assessment.register(key);
    }
  }
  return seeds;
};

const buildLengthSpaces = (scene: GeometryScene, quantities: PositiveLength[], options: DiscoveryOptions, budget: DiscoveryBudget, space: RationalRelationSpace): RelationSeed[] => {
  const byId = new Map(quantities.map((q) => [q.id, q]));
  const names = (q: PositiveLength): [string, string] => [scene.points[q.left].name, scene.points[q.right].name];
  const order = scene.points.map((_, i) => i).sort((a, b) => scene.points[a].name.localeCompare(scene.points[b].name));
  const seeds: RelationSeed[] = []; const seen = new Set<string>(); let attempts = 0;
  outer: for (const vertices of balancedTriples(order)) {
    if (!budget.take('Length seed triples', options.maxTriangles)) break outer;
    if (seeds.length >= options.maxModels) { budget.note(`Length model limit (${options.maxModels}) reached; models are partial.`); break outer; }
    if (attempts >= 12) { budget.note('Length seed limit (12) reached; models are partial.'); break outer; }
    const [a, b, c] = vertices;
    const edges = [[a, b], [a, c], [b, c]].map(([x, y]) => byId.get(segmentId(x, y)));
    if (edges.some((edge) => !edge)) continue;
    const [anchor, first, second] = edges as [PositiveLength, PositiveLength, PositiveLength];
    if (Math.abs(orientedDoubleArea(scene.points[a].coordinates, scene.points[b].coordinates, scene.points[c].coordinates)) <= EPSILON * Math.max(...edges.map((q) => q!.length)) ** 2) continue;
    attempts += 1;
    const bases: PositiveLength[] = [];
    let index = new RationalCombinationIndex([], RATIOS);
    for (const candidate of [first, second]) if (!index.fit(candidate.value - anchor.value, EPSILON / 2)) {
      bases.push(candidate); index = new RationalCombinationIndex(bases.map((q) => q.value - anchor.value), RATIOS);
    }
    const fits: Array<{ quantity: PositiveLength; fit: NonNullable<ReturnType<RationalCombinationIndex['fit']>> }> = [];
    for (const quantity of quantities) {
      if (!vertices.includes(quantity.left) && !vertices.includes(quantity.right)) continue;
      if (!budget.take('Length model fits', options.maxComparisons)) break outer;
      const fit = index.fit(quantity.value - anchor.value, EPSILON / 2);
      if (!fit) continue;
      const ratio = RATIOS[fit.offset];
      // Recheck positive raw ratios, including roots and negative powers;
      // dimensional consistency is enforced by dividing every length by L0.
      const predicted = Math.pow(ratio.ratio[0] / ratio.ratio[1]
        * bases.reduce((product, base, i) => product * (base.length / anchor.length) ** fit.coefficients[i], 1), 1 / fit.denominator);
      const actual = quantity.length / anchor.length;
      if (!Number.isFinite(predicted) || !(predicted > 0) || Math.abs(actual - predicted) > EPSILON / 2 * Math.max(actual, predicted)) continue;
      fits.push({ quantity, fit });
    }
    if (fits.length < bases.length + 3) continue;
    const signature = fits.map(({ quantity }) => quantity.id).sort().join(';');
    if (seen.has(signature)) continue;
    const key = `length-space:${vertices.map((i) => scene.points[i].name).join('|')}`;
    const members: LengthModel['members'] = fits.map(({ quantity, fit }) => ({ segment: names(quantity), coefficients: fit.coefficients,
      denominator: fit.denominator, ratio: RATIOS[fit.offset].ratio, residual: fit.residual }));
    const model = { anchor: names(anchor), generators: bases.map(names), members, constraintRank: 0 };
    const ids = new Map(quantities.map((q) => [segmentKey(names(q)), q.id]));
    const scoringGroups: string[][] = [];
    const effective = new Set<string>();
    let rank = 0;
    const guards = new Map<string, [string, string]>();
    for (const member of members) {
      const normalized = normalizeLengthConstraint(model, member);
      normalized.guards.forEach((segment) => guards.set(segmentKey(segment), segment));
      if (normalized.identity) continue;
      const support = [...new Set(normalized.segments.flat())].sort();
      support.forEach((name) => effective.add(name));
      const row = Object.fromEntries([...normalized.row].map(([id, coefficient]) => [
        id === '@factor:2' ? '@log2' : id === '@factor:3' ? '@log3' : ids.get(id)!, coefficient,
      ]));
      if (space.insert(row, key, normalized.errorScale * member.denominator * member.residual + 1e-12) === 'independent') {
        rank += 1; scoringGroups.push(support);
      }
    }
    if (rank === 0) continue;
    seen.add(signature);
    const points = new Set(fits.flatMap(({ quantity }) => [quantity.left, quantity.right]));
    seeds.push({ kind: 'length-space', key, points, confidence: 0.98,
      lengthModel: { ...model, constraintRank: rank }, scoringGroups,
      support: { effective: [...effective].sort(), guards: [...guards.values()], frame: [...new Set([model.anchor, ...model.generators].flat())].filter((name) => !effective.has(name)),
        reason: 'Positive-length factors cancelled before scoring; value is the maximum over new normalized constraints.' },
      witness: { points: [...points].map((i) => scene.points[i].name) } });
  }
  return seeds;
};
