import { predicatePoints } from '../../ir/types';
import type { ConditionSelection, GeometryPredicate, Rational, ReasoningProblem, Segment, SegmentTerm } from '../../ir/types';
import { AG2_COMMIT, AG2_LIMITS } from './capabilities';

export interface AngleBranch {
  angle: [string, string, string];
  sign: number;
  lift: number;
  role: 'assumption' | 'goal';
}
export interface Ag2Export {
  version: 1;
  engineCommit: string;
  premise: string;
  goals: string[];
  queries: Array<{ id: string; goals: string[] }>;
  text: string;
  acceptedIds: string[];
  goalId: string | null;
  alreadyAssumed: boolean;
  branches: AngleBranch[];
  names: Array<{ id: string; name: string; symbol: string }>;
  normalization: { origin: { x: number; y: number }; scale: number };
}
export interface Ag2ExportResult { value: Ag2Export | null; errors: string[]; }

const fraction = ({ numerator, denominator }: Rational): string => {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0
    || Math.abs(numerator) > AG2_LIMITS.constant || denominator > AG2_LIMITS.constant) throw new Error('Invalid or oversized rational constant.');
  return denominator === 1 ? String(numerator) : `${numerator}/${denominator}`;
};
const pairKey = (pair: Segment) => JSON.stringify([...pair].sort());

/** Export only accepted conditions. Neither observed consequences nor scores are premises. */
const compileAg2Problem = (problem: ReasoningProblem, selection: ConditionSelection, queryIds: readonly string[]): Ag2ExportResult => {
  try {
    const candidates = new Map(problem.candidates.map((candidate) => [candidate.id, candidate]));
    const acceptedIds = [...new Set(selection.acceptedIds)].sort();
    const accepted = acceptedIds.map((id) => candidates.get(id));
    const goal = selection.goalId === null ? null : candidates.get(selection.goalId);
    const queries = [...new Set(queryIds)].map((id) => candidates.get(id));
    if (accepted.some((candidate) => !candidate) || (selection.goalId !== null && !goal)) throw new Error('A selected condition or goal is no longer available.');
    if (queries.some((candidate) => !candidate)) throw new Error('A coverage query is no longer available.');
    const selected = [...accepted, ...queries];
    if (!selected.length) throw new Error('Select conditions or a goal first.');
    if (selected.some((candidate) => !candidate!.predicates.length || candidate!.diagnostics.length)) throw new Error('A selected observation cannot be exported.');
    if (selected.some((candidate) => candidate!.source.snapshot !== problem.snapshot)) throw new Error('Observations belong to a different construction snapshot.');
    const used = new Set(selected.flatMap((candidate) => candidate!.predicates.flatMap(predicatePoints)));
    const objects = problem.objects.filter((object) => used.has(object.id)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (objects.length !== used.size || objects.some((object) => !object.coordinates || !Number.isFinite(object.coordinates.x) || !Number.isFinite(object.coordinates.y))) throw new Error('Every referenced point needs finite two-dimensional coordinates.');
    if (objects.length > AG2_LIMITS.points) throw new Error(`This run exceeds the ${AG2_LIMITS.points}-point budget. Select fewer conditions.`);
    const origin = objects[0]?.coordinates ?? { x: 0, y: 0 };
    const scale = Math.max(...objects.map((object) => Math.hypot(object.coordinates!.x - origin.x, object.coordinates!.y - origin.y))) || 1;
    if (!Number.isFinite(scale)) throw new Error('Coordinate range is too large to normalize.');
    const points = new Map(objects.map((object) => [object.id, { x: (object.coordinates!.x - origin.x) / scale, y: (object.coordinates!.y - origin.y) / scale }]));
    const names = objects.map((object, i) => ({ id: object.id, name: object.name, symbol: `p${i}` }));
    const symbols = new Map(names.map((entry) => [entry.id, entry.symbol]));
    const symbol = (id: string) => { const name = symbols.get(id); if (!name) throw new Error('Unknown point reference.'); return name; };
    const branches: AngleBranch[] = [];
    const line = (segment: Segment) => {
      const [a, b] = segment.map((id) => points.get(id)!);
      if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 1e-8) throw new Error('A direction or length uses coincident or poorly separated points.');
      return [...segment].sort() as Segment;
    };
    const linear = (kind: string, terms: SegmentTerm[], constant?: Rational): string[] => {
      const rows = new Map<string, SegmentTerm>();
      for (const term of terms) {
        if (!Number.isSafeInteger(term.coefficient) || Math.abs(term.coefficient) > AG2_LIMITS.coefficient) throw new Error('Coefficient budget exceeded.');
        if (term.coefficient === 0) continue;
        const segment = line(term.segment); const key = pairKey(segment);
        const coefficient = (rows.get(key)?.coefficient ?? 0) + term.coefficient;
        if (coefficient) rows.set(key, { segment, coefficient }); else rows.delete(key);
      }
      const values = [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, term]) => term);
      if (values.some((term) => Math.abs(term.coefficient) > AG2_LIMITS.coefficient)) throw new Error('Combined coefficient budget exceeded.');
      // Keep integer factors: dividing modular angle rows can lose a branch.
      const invert = values[0]?.coefficient < 0;
      if (invert) values.forEach((term) => { term.coefficient = -term.coefficient; });
      if (values.length === 2 && values[0].coefficient === -values[1].coefficient
        && (kind === 'distseq' || kind === 'distmeq' && constant?.numerator === constant?.denominator)) {
        return [['cong', ...values.flatMap((term) => term.segment.map(symbol))].join(' ')];
      }
      let tail: string | undefined;
      if (constant) {
        const value = kind === 'distmeq' ? (invert ? constant : { numerator: constant.denominator, denominator: constant.numerator })
          : { numerator: constant.numerator * (invert ? 180 : -180), denominator: constant.denominator };
        tail = fraction(value);
      }
      if (!values.length) {
        const identity = !constant || (kind === 'distmeq' ? constant.numerator === constant.denominator : constant.numerator % constant.denominator === 0);
        if (identity) return [];
        throw new Error('A selected relation reduces to an inconsistent constant.');
      }
      return [[kind, ...values.flatMap((term) => term.segment.map(symbol)), ...values.map((term) => term.coefficient), ...(tail === undefined ? [] : [tail])].join(' ')];
    };
    const lower = (predicate: GeometryPredicate, role: AngleBranch['role']): string[] => {
      if (predicate.kind === 'collinear' || predicate.kind === 'concyclic') {
        const ids = [...new Set(predicate.points)].sort();
        if (ids.length < (predicate.kind === 'collinear' ? 3 : 4)) throw new Error('An incidence predicate has too few distinct points.');
        return [[predicate.kind === 'collinear' ? 'coll' : 'cyclic', ...ids.map(symbol)].join(' ')];
      }
      if (predicate.kind === 'coincident') return [['overlap', ...[...predicate.points].sort().map(symbol)].join(' ')];
      if ('segments' in predicate) {
        const pairs = predicate.segments.map(line).sort((a, b) => pairKey(a) < pairKey(b) ? -1 : pairKey(a) > pairKey(b) ? 1 : 0);
        if (pairKey(pairs[0]) === pairKey(pairs[1]) && predicate.kind !== 'perpendicular') return [];
        return [[{ parallel: 'para', perpendicular: 'perp', 'equal-length': 'cong' }[predicate.kind], ...pairs.flat().map(symbol)].join(' ')];
      }
      if (predicate.kind === 'midpoint') return [...lower({ kind: 'collinear', points: [predicate.point, ...predicate.segment] }, role),
        ...lower({ kind: 'equal-length', segments: [[predicate.point, predicate.segment[0]], [predicate.point, predicate.segment[1]]] }, role)];
      if (predicate.kind === 'ordinary-angle-equation') {
        fraction(predicate.pi);
        let lift = 0;
        let observed = 0;
        const terms = predicate.terms.flatMap((term): SegmentTerm[] => {
          const [a, v, b] = term.angle; line([v, a]); line([v, b]);
          const pa = points.get(a)!; const pv = points.get(v)!; const pb = points.get(b)!;
          const u = { x: pa.x - pv.x, y: pa.y - pv.y }; const w = { x: pb.x - pv.x, y: pb.y - pv.y };
          const signed = Math.atan2(w.x * u.y - w.y * u.x, u.x * w.x + u.y * w.y);
          if (Math.abs(Math.sin(signed)) < 1e-8) throw new Error('An ordinary angle is on a degenerate branch boundary.');
          observed += term.coefficient * Math.abs(signed) / Math.PI;
          const sign = signed > 0 ? 1 : -1;
          const direction = (x: number, y: number) => ((Math.atan2(y, x) / Math.PI) % 1 + 1) % 1;
          const k = Math.round(Math.abs(signed) / Math.PI - sign * (direction(u.x, u.y) - direction(w.x, w.y)));
          branches.push({ angle: term.angle, sign, lift: k, role }); lift += term.coefficient * k;
          return [{ segment: [v, a], coefficient: term.coefficient * sign }, { segment: [v, b], coefficient: -term.coefficient * sign }];
        });
        if (!Number.isFinite(observed) || Math.abs(observed - predicate.pi.numerator / predicate.pi.denominator) > 1e-6) throw new Error('An ordinary angle equation does not hold in the declared witness branch.');
        return linear('angeq', terms, { numerator: predicate.pi.numerator - lift * predicate.pi.denominator, denominator: predicate.pi.denominator });
      }
      if ('terms' in predicate) {
        fraction(predicate.constant);
        if (predicate.kind === 'length-sum' && predicate.constant.numerator !== 0) throw new Error('Only homogeneous length sums are supported.');
        if (predicate.kind === 'length-product' && predicate.constant.numerator <= 0) throw new Error('Length products need a positive constant.');
        return linear(predicate.kind === 'direction-equation' ? 'angeq' : predicate.kind === 'length-sum' ? 'distseq' : 'distmeq',
          predicate.terms, predicate.kind === 'length-sum' ? undefined : predicate.constant);
      }
      throw new Error('Unsupported geometric predicate.');
    };
    const premises = [...new Set(accepted.flatMap((candidate) => candidate!.predicates.flatMap((predicate) => lower(predicate, 'assumption'))))];
    const queryGoals = queries.map((candidate) => ({ id: candidate!.id, goals: [...new Set(candidate!.predicates.flatMap((predicate) => lower(predicate, 'goal')))] }));
    const goals = [...new Set(queryGoals.flatMap((query) => query.goals))];
    if (premises.length + goals.length > AG2_LIMITS.predicates) throw new Error(`This run exceeds the ${AG2_LIMITS.predicates}-predicate budget.`);
    const directlyIncluded = (target: string) => premises.includes(target) || premises.some((premise) => {
      const [kind, ...args] = premise.split(' '); const [targetKind, ...targetArgs] = target.split(' ');
      return (kind === 'coll' || kind === 'cyclic') && kind === targetKind && targetArgs.every((arg) => args.includes(arg));
    });
    const declarations = names.map(({ id, symbol: name }) => { const point = points.get(id)!; return `${name}@${point.x}_${point.y} = `; });
    if (!declarations.length) throw new Error('The selection contains no points.');
    const premise = declarations.join('; ') + premises.join(', ');
    return { value: { version: 1, engineCommit: AG2_COMMIT, premise, goals, queries: queryGoals,
      text: goals.length ? goals.map((target) => `${premise} ? ${target}`).join('\n') : premise,
      acceptedIds, goalId: selection.goalId, alreadyAssumed: Boolean(goal && goals.every(directlyIncluded)),
      branches, names, normalization: { origin: { ...origin }, scale } }, errors: [] };
  } catch (error) {
    return { value: null, errors: [error instanceof Error ? error.message : 'Problem export failed.'] };
  }
};

export const exportAg2Problem = (problem: ReasoningProblem, selection: ConditionSelection): Ag2ExportResult =>
  compileAg2Problem(problem, selection, selection.goalId === null ? [] : [selection.goalId]);

/** Several queries share one closure, coordinate frame and symbol mapping. */
export const exportAg2Queries = (problem: ReasoningProblem, acceptedIds: string[], queryIds: string[]): Ag2ExportResult =>
  compileAg2Problem(problem, { acceptedIds, goalId: queryIds[0] ?? null }, queryIds);
