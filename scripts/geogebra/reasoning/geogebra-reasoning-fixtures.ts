import { candidate, discoveredMidpointProblem, midpointConstruction, midpointProblem } from '../../../src/features/geogebra/reasoning/__fixtures__/problems';
import { exportAg2Problem, exportAg2Queries } from '../../../src/features/geogebra/reasoning/backends/ag2/exportProblem';
import type { ConditionSelection, ReasoningProblem } from '../../../src/features/geogebra/reasoning/ir/types';
import { proposeConditions } from '../../../src/features/geogebra/reasoning/selection/proposeConditions';
import { isogonalConstruction, isogonalSamples } from '../../../src/features/geogebra/reasoning/__fixtures__/isogonal';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from '../../../src/features/geogebra/reasoning/selection/types';

const cases: Array<{ name: string; problem: ReasoningProblem; selection: ConditionSelection; expected: string }> = [];
for (const [name, acceptedIds, goalId, expected] of [
  ['midsegment', ['m-midpoint', 'n-midpoint'], 'midsegment', 'derived'],
  ['numerically-true-without-conditions', [], 'midsegment', 'not-derived'],
  ['false-target', ['m-midpoint', 'n-midpoint'], 'false-goal', 'not-derived'],
  ['accepted-target', ['midsegment'], 'midsegment', 'already-assumed'],
] as const) cases.push({ name, problem: midpointProblem(), selection: { acceptedIds: [...acceptedIds], goalId }, expected });
const discovered = discoveredMidpointProblem();
const midpoints = discovered.candidates.filter((entry) => entry.predicates.some((predicate) => predicate.kind === 'midpoint'));
const target = discovered.candidates.find((entry) => entry.predicates.some((predicate) => predicate.kind === 'parallel'))!;
cases.push({ name: 'opaque-discovery-to-engine', problem: discovered, selection: { acceptedIds: midpoints.map((entry) => entry.id), goalId: target.id }, expected: 'derived' });
const proposal = proposeConditions(midpointConstruction());
const automatic = { ...proposal.problem, candidates: [...proposal.problem.candidates, target] };
cases.push({ name: 'automatic-local-conditions-to-engine', problem: automatic, selection: { acceptedIds: proposal.coreIds, goalId: target.id }, expected: 'derived' });

for (const [name, graph] of [['isogonal-interior', isogonalConstruction()], ['isogonal-exterior-reflected', isogonalConstruction({ x: -2, y: 1 }, 1)]] as const) {
  const suggested = proposeConditions(graph, DEFAULT_CHARACTERIZATION_OPTIONS, isogonalSamples());
  const selected = suggested.coreIds.flatMap((id) => suggested.problem.candidates.find((entry) => entry.id === id)!.predicates);
  if (selected.length !== 2 || !selected.every((predicate) => predicate.kind === 'directed-angle-equation')) throw new Error('Expected two independent directed black-box conditions');
  suggested.problem.candidates.push(candidate('combined-directions', [{ kind: 'directed-angle-equation',
    terms: selected.flatMap((predicate) => 'pi' in predicate ? predicate.terms : []), pi: { numerator: 0, denominator: 1 } }]));
  cases.push({ name, problem: suggested.problem, selection: { acceptedIds: suggested.coreIds, goalId: 'combined-directions' }, expected: 'derived' });
}

const algebra = midpointProblem();
algebra.candidates.push(candidate('ratio', [{ kind: 'length-product', terms: [
  { segment: ['a', 'b'], coefficient: 1 }, { segment: ['a', 'm'], coefficient: -1 },
], constant: { numerator: 2, denominator: 1 } }]));
cases.push({ name: 'exact-length-ratio', problem: algebra, selection: { acceptedIds: ['m-midpoint'], goalId: 'ratio' }, expected: 'derived' });
for (const entry of discovered.candidates) cases.push({ name: `accepted-discovery:${entry.label}`, problem: discovered,
  selection: { acceptedIds: [entry.id], goalId: entry.id }, expected: 'already-assumed' });
const angles = midpointProblem();
angles.objects.push({ ...angles.objects[0], id: 'd', name: 'D', coordinates: { x: 2, y: -4 } },
  { ...angles.objects[0], id: 'e', name: 'E', coordinates: { x: -3, y: 4 } });
angles.candidates.push(candidate('mirror-angle', [{ kind: 'ordinary-angle-equation', terms: [
  { angle: ['b', 'a', 'c'], coefficient: 1 }, { angle: ['b', 'a', 'd'], coefficient: -1 },
], pi: { numerator: 0, denominator: 1 } }]), candidate('double-angle', [{ kind: 'ordinary-angle-equation', terms: [
  { angle: ['b', 'a', 'c'], coefficient: 2 }, { angle: ['b', 'a', 'e'], coefficient: -1 },
], pi: { numerator: 0, denominator: 1 } }]));
for (const id of ['mirror-angle', 'double-angle']) cases.push({ name: id, problem: angles, selection: { acceptedIds: [id], goalId: id }, expected: 'already-assumed' });
const output = cases.map(({ name, problem, selection, expected }) => {
  const exported = exportAg2Problem(problem, selection);
  if (!exported.value) throw new Error(`${name}: ${exported.errors.join('; ')}`);
  return { name, problem: exported.value, expected };
});
const coverage = exportAg2Queries(midpointProblem(), ['m-midpoint', 'n-midpoint'], ['midsegment', 'false-goal']);
if (!coverage.value) throw new Error(coverage.errors.join('; '));
output.push({ name: 'coverage-positive-and-negative', problem: coverage.value, expected: 'not-derived' });
process.stdout.write(JSON.stringify(output));
