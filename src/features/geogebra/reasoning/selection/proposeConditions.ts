import { detectGeometryRelations } from '../../analysis/geometryRelations';
import type { DependencyGraph } from '../../analysis/graphTypes';
import type { GeometryRelationKind } from '../../analysis/geometryTypes';
import { createDiscoveryProblem } from '../sources/discoveryProblem';
import { formatPredicate } from '../ir/formatPredicate';
import { predicatePoints } from '../ir/types';
import type { ConditionCandidate, GeometryPredicate, ReasoningObject, ReasoningProblem } from '../ir/types';
import { buildDependencyContext, hasPointCoordinates } from './dependencyScope';
import { assessLocalConstraint, constraintRank } from './localConstraints';
import type { Gradient } from './localConstraints';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from './types';
import type { CharacterizationOptions, CharacterizationProposal, ObjectCharacterization } from './types';
import type { SamplingResult } from '../sampling/types';

const KINDS: GeometryRelationKind[] = ['collinear', 'parallel', 'perpendicular', 'concyclic', 'coincident-points', 'midpoint',
  'equal-lengths', 'equal-angles', 'length-multiple', 'angle-multiple', 'complementary-angles', 'supplementary-angles', 'similar-triangles', 'congruent-triangles'];
const costOf = (predicate: GeometryPredicate): number => {
  const support = new Set(predicatePoints(predicate)).size;
  const base = predicate.kind === 'midpoint' ? 1.2 : predicate.kind === 'collinear' || predicate.kind === 'coincident' ? 1
    : predicate.kind === 'ordinary-angle-equation' ? 2 : 'terms' in predicate ? 2.2 : 1.3;
  const coefficients = 'terms' in predicate ? predicate.terms.reduce((sum, term) => sum + Math.abs(term.coefficient), 0) : 0;
  return base + 0.15 * Math.max(0, support - 3) + 0.05 * coefficients;
};
const keyOf = (predicate: GeometryPredicate): string => {
  const pair = (names: string[]) => [...names].sort();
  if ('points' in predicate) return JSON.stringify([predicate.kind, pair(predicate.points)]);
  if ('segments' in predicate) return JSON.stringify([predicate.kind, predicate.segments.map(pair).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  if (predicate.kind === 'midpoint') return JSON.stringify([predicate.kind, predicate.point, pair(predicate.segment)]);
  return JSON.stringify(predicate);
};
const bounded = (value: number, fallback: number, maximum: number) => Number.isFinite(value) ? Math.max(1, Math.min(maximum, Math.floor(value))) : fallback;

/** Target-free suggestions: dependency ownership and local rank, not command semantics. */
export const proposeConditions = (graph: DependencyGraph, settings: CharacterizationOptions = DEFAULT_CHARACTERIZATION_OPTIONS, sampling?: SamplingResult): CharacterizationProposal => {
  const options: CharacterizationOptions = { maxObjects: bounded(settings.maxObjects, 16, 24), maxScopePoints: bounded(settings.maxScopePoints, 10, 12),
    maxCandidatesPerObject: bounded(settings.maxCandidatesPerObject, 80, 128), maxConditions: bounded(settings.maxConditions, 24, 40), allowEarlierContext: settings.allowEarlierContext };
  const problem: ReasoningProblem = createDiscoveryProblem(graph);
  const context = buildDependencyContext(problem.objects);
  const positions = new Map(context.ordered.map((object, i) => [object.id, i]));
  const candidates = new Map<string, ConditionCandidate>(); const reports: ObjectCharacterization[] = [];
  const samples = sampling?.samples.map((sample) => ({ ...sample, objects: problem.objects.map((point) => ({ ...point,
    coordinates: point.coordinates ? sample.coordinates[point.id] ?? undefined : undefined })) })) ?? [];
  const accepted: string[] = []; const diagnostics: string[] = [];
  const eligible = context.ordered.filter(hasPointCoordinates);
  let count = 0;
  for (const object of eligible) {
    const report: ObjectCharacterization = { objectId: object.id, scopeIds: [], contextIds: [], candidateIds: [], coreIds: [], rank: 0,
      conditioning: null, status: 'partial', reasons: [], rejectedCandidates: 0, counterexamples: [], diagnostics: [] };
    reports.push(report);
    if (context.incomplete.has(object.id)) { report.status = 'unavailable'; report.diagnostics.push('Dependencies are incomplete or cyclic; no conditions were suggested.'); continue; }
    if (context.uncertain.has(object.id)) report.diagnostics.push('Expression parsing is partial; the extracted dependency scope is provisional.');
    if (!object.dependencies.length) { report.status = 'free'; continue; }
    if (count++ >= options.maxObjects) { report.status = 'unavailable'; report.diagnostics.push('Object search budget reached.'); continue; }
    const ancestors = context.ancestors.get(object.id) ?? new Set<string>();
    const distance = context.distances.get(object.id)!;
    const upstream = eligible.filter((point) => ancestors.has(point.id)).sort((a, b) => distance.get(a.id)! - distance.get(b.id)! || positions.get(a.id)! - positions.get(b.id)!);
    const scope = [object, ...upstream.slice(0, options.maxScopePoints - 1)];
    if (scope.length <= 1) { report.diagnostics.push('No finite upstream points are available to describe this object.'); continue; }
    if (upstream.length >= options.maxScopePoints) report.diagnostics.push('Upstream point scope was truncated.');
    let gradients: Gradient[] = [];
    const ranked = new Map<string, { candidate: ConditionCandidate; gradients: Gradient[]; cost: number }>();
    const search = (points: ReasoningObject[], contextIds: string[]) => {
      const allowed = new Set(points.map((point) => point.id));
      const scopedGraph = { ...graph, nodes: graph.nodes.map((node) => allowed.has(node.id) ? node : { ...node, coordinates: undefined }) };
      const found = detectGeometryRelations(scopedGraph, graph.generatedAt, { enabledKinds: KINDS, maxTriangles: 3000, maxAngles: 3000,
        maxComparisons: 40000, maxModels: 0, maxRelations: 800, compressConsequences: false });
      if (found.diagnostics.length) report.diagnostics.push('Local numerical discovery reached a budget or reported incomplete scope.');
      const local = createDiscoveryProblem(scopedGraph, found);
      const atoms = new Map<string, { candidate: ConditionCandidate; gradients: Gradient[]; cost: number }>();
      for (const group of local.candidates) for (const predicate of group.predicates) {
        const support = new Set(predicatePoints(predicate));
        if (!support.has(object.id) || [...support].some((id) => !allowed.has(id))) continue;
        const id = `local:${object.id}:${keyOf(predicate)}`;
        if (ranked.has(id)) continue;
        const assessment = assessLocalConstraint(predicate, object.id, problem.objects);
        if (!assessment?.gradients.length) continue;
        const trials = samples.map((sample) => ({ index: sample.index, phase: sample.phase, result: assessLocalConstraint(predicate, object.id, sample.objects, false) }));
        const discoveryTrials = trials.filter((trial) => trial.phase === 'discovery' && trial.result);
        const holdoutTrials = trials.filter((trial) => trial.phase === 'holdout' && trial.result);
        if (samples.length && (discoveryTrials.length < 3 || discoveryTrials.some((trial) => trial.result!.residual > 2e-6))) {
          report.rejectedCandidates += 1;
          const failure = discoveryTrials.find((trial) => trial.result!.residual > 2e-6);
          if (failure && report.counterexamples.length < 8) report.counterexamples.push({ label: formatPredicate(predicate, problem.objects),
            index: failure.index, phase: 'discovery', residual: failure.result!.residual });
          continue;
        }
        const holdoutPassed = !samples.length || holdoutTrials.length >= 1 && holdoutTrials.every((trial) => trial.result!.residual <= 2e-6);
        const extra = contextIds.filter((id) => support.has(id));
        const candidate: ConditionCandidate = { ...group, id, label: formatPredicate(predicate, problem.objects), predicates: [predicate],
          characterization: { objectId: object.id, contextIds: extra },
          evidence: samples.length ? { kind: 'sampled', seed: sampling!.seed, discoverySamples: discoveryTrials.length,
            holdoutSamples: holdoutTrials.length, skippedSamples: samples.length - discoveryTrials.length - holdoutTrials.length } : { kind: 'single-snapshot' },
          diagnostics: holdoutPassed ? [] : ['A held-out configuration contradicted this condition, or too few held-out samples were defined.'] };
        atoms.set(id, { candidate, gradients: assessment.gradients, cost: costOf(predicate) + extra.length });
      }
      const ordered = [...atoms.values()].sort((a, b) => a.cost - b.cost || a.candidate.id.localeCompare(b.candidate.id));
      const remaining = options.maxCandidatesPerObject - ranked.size;
      if (ordered.length > remaining) report.diagnostics.push('Local condition candidate budget reached.');
      for (const item of ordered.slice(0, remaining)) ranked.set(item.candidate.id, item);
    };
    const choose = () => {
      while (constraintRank(gradients).rank < 2 && accepted.length < options.maxConditions) {
        const rank = constraintRank(gradients).rank;
        const choices = [...ranked.values()].filter((item) => !report.coreIds.includes(item.candidate.id))
          .map((item) => ({ ...item, gain: constraintRank([...gradients, ...item.gradients]).rank - rank }))
          .filter((item) => item.gain > 0).sort((a, b) => b.gain / b.cost - a.gain / a.cost || a.candidate.id.localeCompare(b.candidate.id));
        if (!choices.length) break;
        const next = choices[0]; gradients = [...gradients, ...next.gradients];
        report.coreIds.push(next.candidate.id); accepted.push(next.candidate.id);
        report.reasons.push({ candidateId: next.candidate.id, rankGain: next.gain, cost: next.cost });
      }
    };
    search(scope, []); choose();
    if (constraintRank(gradients).rank < 2 && options.allowEarlierContext && scope.length < options.maxScopePoints) {
      const related = eligible.filter((point) => positions.get(point.id)! < positions.get(object.id)! && !ancestors.has(point.id)
        && !context.incomplete.has(point.id) && [...(context.ancestors.get(point.id) ?? [])].some((id) => ancestors.has(id)))
        .sort((a, b) => positions.get(b.id)! - positions.get(a.id)!);
      const extra = related.slice(0, options.maxScopePoints - scope.length);
      if (extra.length) { scope.push(...extra); report.contextIds = extra.map((point) => point.id); search(scope, report.contextIds); choose(); }
    }
    report.scopeIds = scope.map((point) => point.id);
    report.candidateIds = [...ranked.keys()];
    ranked.forEach((item, id) => candidates.set(id, item.candidate));
    // Held-out failures invalidate the chosen description; never retry selection on them.
    const failed = report.coreIds.filter((id) => candidates.get(id)!.diagnostics.length);
    if (failed.length) {
      report.coreIds = report.coreIds.filter((id) => !failed.includes(id));
      for (const id of failed) accepted.splice(accepted.indexOf(id), 1);
      gradients = report.coreIds.flatMap((id) => ranked.get(id)!.gradients);
      report.diagnostics.push(`${failed.length} proposed conditions failed held-out checks; no replacements were fitted to those samples.`);
    }
    const assessment = constraintRank(gradients); report.rank = assessment.rank; report.conditioning = assessment.conditioning;
    report.status = report.rank === 2 ? 'isolated-locally' : 'partial';
    if (report.rank < 2) report.diagnostics.push('Remaining freedom may be intentional, or the available property language may be insufficient.');
    if (report.coreIds.some((id) => candidates.get(id)!.characterization!.contextIds.length)) report.diagnostics.push('Some suggested conditions use earlier objects sharing upstream inputs.');
  }
  if (accepted.length >= options.maxConditions) diagnostics.push('Total suggested-condition budget reached; some objects may be only partially described.');
  if (eligible.length > 40) diagnostics.push('Only selected conditions within the prover point budget can be evaluated together.');
  problem.candidates = [...candidates.values()];
  problem.diagnostics.push('Local condition search uses an independent numerical pool; the display list and its score filters are not its input.');
  if (sampling) diagnostics.push(...sampling.diagnostics);
  return { version: 1, problem, objects: reports, coreIds: accepted, diagnostics, sampling };
};
