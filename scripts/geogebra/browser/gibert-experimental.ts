import deferred from '../../../src/features/geogebra/commands/custom/data/related-curves/deferred.json';
import candidateCircuits from '../../../src/features/geogebra/commands/custom/generated/relatedCurveCandidates.json';
import { gibertCurveRecords } from '../../../src/features/geogebra/commands/custom/builders/relatedCurves';
import { similarityCurveCircuits } from '../../../src/features/geogebra/commands/custom/builders/relatedCurveBackends';

/** Authoring pages only. No production module imports this opt-in experiment. */
export const enableExperimentalGibertCurve = (id: string, enabled: boolean) => {
  if (!enabled || gibertCurveRecords.some(record => record.id === id)) return;
  const record = deferred.find(candidate => candidate.id === id);
  const circuit = candidateCircuits[id as keyof typeof candidateCircuits];
  if (!record || !circuit) throw new Error(`${id} has no verified experimental circuit.`);
  gibertCurveRecords.push(record);
  similarityCurveCircuits[id] = circuit;
};
