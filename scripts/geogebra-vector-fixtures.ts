import { candidate } from '../src/features/geogebra/reasoning/__fixtures__/problems';
import { productPredicate, productTransferProblem, vectorProblemA, vectorProblemB, vectorSamplesB } from '../src/features/geogebra/reasoning/__fixtures__/vectorProducts';
import { exportAg2Proof, exportAg2Queries } from '../src/features/geogebra/reasoning/backends/ag2/exportProblem';
import type { ConditionSelection, ReasoningProblem } from '../src/features/geogebra/reasoning/ir/types';
import { proposeConditions } from '../src/features/geogebra/reasoning/selection/proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from '../src/features/geogebra/reasoning/selection/types';

const output: Array<{ name: string; problem: unknown }> = [];
const add = (name: string, problem: ReasoningProblem, selection: ConditionSelection) => {
  const value = exportAg2Proof(problem, selection);
  if (!value.value) throw new Error(`${name}: ${value.errors.join('; ')}`);
  output.push({ name, problem: value.value });
};
const a = vectorProblemA(); add('A', a.problem, a); add('A-no-premises', a.problem, { acceptedIds: [], goalId: a.goalId });
const automaticB = vectorProblemB();
const proposal = proposeConditions(automaticB.graph, DEFAULT_CHARACTERIZATION_OPTIONS, vectorSamplesB());
const autoProblem = { ...proposal.problem, candidates: [...proposal.problem.candidates,
  ...automaticB.problem.candidates.filter((entry) => ['right', 'goals'].includes(entry.id))] };
add('B-sampled-automatic', autoProblem, { acceptedIds: [...proposal.coreIds, 'right'], goalId: 'goals' });
for (const [name, x, y, k, scale, mirror] of [
  ['B', 2.2, 0.6, 1.4, 1, 1], ['B-reflected-small', 1.9, -0.4, 0.8, 1e-10, -1], ['B-large', -1.1, 2.3, 1.7, 1e10, 1],
] as const) {
  const b = vectorProblemB(x, y, k);
  for (const object of b.problem.objects) if (object.coordinates) {
    const { x: px, y: py } = object.coordinates; const angle = 0.47;
    object.coordinates = { x: scale * (4 + px * Math.cos(angle) - mirror * py * Math.sin(angle)),
      y: scale * (-2 + px * Math.sin(angle) + mirror * py * Math.cos(angle)) };
  }
  add(name, b.problem, b);
  const acceptedIds = ['right', 'inverse-dot', 'inverse-cross', 'midpoints', 'intersection'];
  add(`${name}-products`, b.problem, { acceptedIds, goalId: b.goalId });
  if (name === 'B') {
    add('B-cross', b.problem, { acceptedIds, goalId: 'cross-goal' });
    add('B-products-feedback', b.problem, { acceptedIds, goalId: 'feedback-goal' });
    add('B-missing-cross', b.problem, { acceptedIds: acceptedIds.filter((id) => id !== 'inverse-cross'), goalId: 'cross-goal' });
    const coverage = exportAg2Queries(b.problem, acceptedIds, ['goals', 'cross-goal', 'false-goal']);
    if (!coverage.value) throw new Error(coverage.errors.join('; '));
    output.push({ name: 'B-coverage', problem: coverage.value });
  }
}
const fixed = vectorProblemB();
fixed.problem.objects = fixed.problem.objects.slice(0, 4).map((object, i) => ({ ...object, coordinates: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 0 }, { x: 0, y: 3 }][i] }));
fixed.problem.candidates = [candidate('origin', [productPredicate('dot', [[1, [null, 'object:A'], [null, 'object:B']], [-1, [null, 'object:C'], [null, 'object:D']]])]),
  candidate('origin-scaled', [productPredicate('dot', [[2, [null, 'object:A'], [null, 'object:B']], [-2, [null, 'object:C'], [null, 'object:D']]])])];
add('independent-origin', fixed.problem, { acceptedIds: ['origin'], goalId: 'origin-scaled' });
const transfer = productTransferProblem();
add('length-angle-signed', transfer.problem, { acceptedIds: ['lengths-and-angle'], goalId: 'signed-goals' });
add('length-angle-wrong-sign', transfer.problem, { acceptedIds: ['lengths-and-angle'], goalId: 'wrong-sign' });
add('zero-vector', transfer.problem, { acceptedIds: [], goalId: 'zero-vector' });
process.stdout.write(JSON.stringify(output));
