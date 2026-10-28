import { pedalFixture } from '../../../src/features/geogebra/reasoning/__fixtures__/pedal';
import { exportAg2Queries } from '../../../src/features/geogebra/reasoning/backends/ag2/exportProblem';
import { pedalSamples } from '../../../src/features/geogebra/reasoning/__fixtures__/pedal';
import { mapPredicatePoints } from '../../../src/features/geogebra/reasoning/ir/types';
import { proposeConditions } from '../../../src/features/geogebra/reasoning/selection/proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from '../../../src/features/geogebra/reasoning/selection/types';

const cases = (['orthocenter', 'incenter'] as const).flatMap((center) => [false, true].flatMap((extended) => [0, 1, 2].map((variant) => {
  const fixture = pedalFixture(center, variant, extended);
  const result = exportAg2Queries(fixture.problem, fixture.acceptedIds, fixture.targets);
  if (!result.value) throw new Error(result.errors.join('; '));
  return { name: `${center}-${extended ? 'extended' : 'pedal'}-${variant}`, problem: { ...result.value, operation: 'proof' }, targets: fixture.targets };
})));
for (const center of ['orthocenter', 'incenter'] as const) {
  const fixture = pedalFixture(center);
  const proposal = proposeConditions(fixture.graph, DEFAULT_CHARACTERIZATION_OPTIONS, pedalSamples(center));
  proposal.problem.candidates.push(...fixture.problem.candidates.filter((entry) => fixture.targets.includes(entry.id)).map((entry) => ({
    ...entry, predicates: entry.predicates.map((predicate) => mapPredicatePoints(predicate, (name) => `object:${name}`)),
  })));
  const result = exportAg2Queries(proposal.problem, proposal.coreIds, fixture.targets);
  if (!result.value) throw new Error(result.errors.join('; '));
  cases.push({ name: `${center}-automatic`, problem: { ...result.value, operation: 'proof' }, targets: fixture.targets });
}
process.stdout.write(JSON.stringify(cases));
