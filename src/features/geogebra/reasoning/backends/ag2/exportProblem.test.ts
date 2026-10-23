import { describe, expect, it } from 'vitest';
import { candidate, discoveredMidpointProblem, midpointProblem } from '../../__fixtures__/problems';
import { exportAg2Problem, exportAg2Queries, exportAg2Proof } from './exportProblem';
import { isogonalConstruction, isogonalPredicates } from '../../__fixtures__/isogonal';
import { createDiscoveryProblem } from '../../sources/discoveryProblem';
import { reasoningPreset } from '../../preferences/reasoningPreferences';

describe('conditional AG2 export', () => {
  it('honors the additional-query budget, preserves an explicit goal and records computation limits', () => {
    const settings = { ...reasoningPreset(), maxProofQueries: 1, maxProofNodes: 400, maxVectorRounds: 2 };
    const selected = { acceptedIds: ['m-midpoint'], goalId: null };
    const result = exportAg2Proof(midpointProblem(), selected, settings).value!;
    expect(result.queries).toHaveLength(1);
    expect(result.computationLimits).toEqual({ maxProofNodes: 400, maxVectorRounds: 2, maxVectorQueries: 100000 });
    const explicit = exportAg2Proof(midpointProblem(), { ...selected, goalId: 'midsegment' }, settings).value!;
    expect(explicit.queries.map((query) => query.id)).toEqual(['midsegment']);
  });
  it('retains evidence-rejected hypotheses with an explicit mode and source mapping', () => {
    const problem = midpointProblem();
    problem.candidates[0].diagnostics = ['A sampled counterexample was found.'];
    problem.candidates[0].hypothesisEligible = true;
    expect(exportAg2Proof(problem, { acceptedIds: ['m-midpoint'], goalId: null }).value).toBeNull();
    const value = exportAg2Proof(problem, { acceptedIds: ['m-midpoint'], goalId: null, assumptionMode: 'hypothetical' }).value!;
    expect(value.operation).toBe('proof'); expect(value.assumptionMode).toBe('hypothetical');
    expect(value.goalId).toBeNull();
    expect(value.assumptionSources.every((source) => source.candidateIds.includes('m-midpoint'))).toBe(true);
    problem.candidates[0].hypothesisEligible = false;
    expect(exportAg2Proof(problem, { acceptedIds: ['m-midpoint'], goalId: null, assumptionMode: 'hypothetical' }).value).toBeNull();
  });
  it('allows a rejected supported proposition to be queried without assuming it', () => {
    const problem = midpointProblem(); problem.candidates[3].diagnostics = ['Rejected numeric observation'];
    const value = exportAg2Problem(problem, { acceptedIds: ['m-midpoint'], goalId: 'false-goal' }).value!;
    expect(value.premise).not.toContain('perp'); expect(value.goals[0]).toContain('perp');
  });
  it('exports directed isogonal equations with no ordinary-angle branch conditions', () => {
    const problem = createDiscoveryProblem(isogonalConstruction({ x: -2, y: 1 }));
    problem.candidates = [candidate('isogonal', isogonalPredicates())];
    const value = exportAg2Problem(problem, { acceptedIds: ['isogonal'], goalId: 'isogonal' }).value!;
    expect(value.branches).toHaveLength(0);
    expect(value.goals).toHaveLength(3);
    expect(value.premise.match(/angeq/g)).toHaveLength(3);
    expect(value.alreadyAssumed).toBe(true);
  });
  it('never upgrades a modular consequence to a new ordinary-angle conclusion', () => {
    const problem = midpointProblem();
    const terms: Array<{ angle: [string, string, string]; coefficient: number }> = [
      { angle: ['b', 'a', 'c'], coefficient: 1 }, { angle: ['m', 'a', 'n'], coefficient: -1 },
    ];
    problem.candidates.push(candidate('directed', [{ kind: 'directed-angle-equation', terms, pi: { numerator: 0, denominator: 1 } }]),
      candidate('ordinary', [{ kind: 'ordinary-angle-equation', terms, pi: { numerator: 0, denominator: 1 } }]));
    const blocked = exportAg2Problem(problem, { acceptedIds: ['directed'], goalId: 'ordinary' });
    expect(blocked.value).toBeNull(); expect(blocked.errors[0]).toContain('exact ray/inequality proof');
    expect(exportAg2Problem(problem, { acceptedIds: ['ordinary'], goalId: 'ordinary' }).value?.alreadyAssumed).toBe(true);
    expect(exportAg2Problem(problem, { acceptedIds: ['ordinary'], goalId: 'directed' }).value?.goals[0]).toContain('angeq');
  });
  it('preserves directed-angle integer factors and rejects zero-length directions', () => {
    const problem = midpointProblem();
    problem.candidates.push(candidate('directed', [{ kind: 'directed-angle-equation', terms: [
      { angle: ['b', 'a', 'c'], coefficient: 2 },
    ], pi: { numerator: 0, denominator: 1 } }]));
    expect(exportAg2Problem(problem, { acceptedIds: [], goalId: 'directed' }).value?.goals[0]).toContain('2 -2 0');
    problem.objects[2].coordinates = { x: 0, y: 0 };
    expect(exportAg2Problem(problem, { acceptedIds: [], goalId: 'directed' }).errors[0]).toContain('coincident');
  });
  it('keeps coverage queries out of the premises and uses one shared symbol map', () => {
    const result = exportAg2Queries(midpointProblem(), ['m-midpoint', 'n-midpoint'], ['midsegment', 'false-goal']).value!;
    expect(result.queries).toHaveLength(2);
    expect(result.goals).toHaveLength(2);
    expect(result.premise).not.toContain('para');
    expect(result.premise).not.toContain('perp');
    expect(result.queries.every((query) => query.goals.every((goal) => result.goals.includes(goal)))).toBe(true);
  });
  it('keeps unaccepted observations out of premises and maps names safely', () => {
    const problem = midpointProblem();
    problem.objects[0].name = '点 A@0_0 = overlap ?';
    const result = exportAg2Problem(problem, { acceptedIds: ['m-midpoint', 'n-midpoint'], goalId: 'midsegment' });
    expect(result.errors).toEqual([]);
    const value = result.value!;
    expect(value.premise).not.toContain('para');
    expect(value.premise).not.toContain(problem.objects[0].name);
    expect(value.names[0].name).toBe(problem.objects[0].name);
    expect(value.goals).toEqual(['para p1 p2 p3 p4']);
    expect(value.alreadyAssumed).toBe(false);
    expect(value.text.split('?')).toHaveLength(2);
  });

  it('detects a directly accepted goal despite endpoint and pair permutations', () => {
    const problem = midpointProblem();
    problem.candidates.push(candidate('equivalent', [{ kind: 'parallel', segments: [['c', 'b'], ['n', 'm']] }]));
    expect(exportAg2Problem(problem, { acceptedIds: ['equivalent'], goalId: 'midsegment' }).value?.alreadyAssumed).toBe(true);
  });

  it('does not accept observed compression sources implicitly', () => {
    const problem = midpointProblem();
    problem.candidates[0].source.derivedFrom = ['n-midpoint'];
    const value = exportAg2Problem(problem, { acceptedIds: ['m-midpoint'], goalId: 'midsegment' }).value!;
    expect(value.acceptedIds).toEqual(['m-midpoint']);
    expect(value.premise.match(/cong/g)).toHaveLength(1);
  });

  it('recognizes length equality expressed as an equation as directly accepted', () => {
    const problem = midpointProblem();
    problem.candidates.push(candidate('length-equation', [{ kind: 'length-sum', terms: [
      { segment: ['a', 'm'], coefficient: -2 }, { segment: ['b', 'm'], coefficient: 2 },
    ], constant: { numerator: 0, denominator: 1 } }]));
    problem.candidates.push(candidate('length-goal', [{ kind: 'equal-length', segments: [['m', 'a'], ['m', 'b']] }]));
    expect(exportAg2Problem(problem, { acceptedIds: ['length-equation'], goalId: 'length-goal' }).value?.alreadyAssumed).toBe(true);
  });

  it('refuses obsolete snapshots, missing references and unsupported selections', () => {
    const problem = midpointProblem();
    problem.candidates[0].source.snapshot = 122;
    expect(exportAg2Problem(problem, { acceptedIds: ['m-midpoint'], goalId: null }).value).toBeNull();
    expect(exportAg2Problem(problem, { acceptedIds: [], goalId: 'missing' }).value).toBeNull();
    problem.candidates.push(candidate('unsupported', []));
    expect(exportAg2Problem(problem, { acceptedIds: ['unsupported'], goalId: null }).value).toBeNull();
  });

  it('preserves opaque definitions and converts independently observed midpoint properties', () => {
    const problem = discoveredMidpointProblem();
    expect(problem.objects.find((point) => point.name === 'M')?.definition).toContain('Element(Zip');
    expect(problem.objects.find((point) => point.name === 'N')?.definition).toBe('unknown(A,C)');
    expect(problem.candidates.some((entry) => entry.predicates.some((predicate) => predicate.kind === 'midpoint'))).toBe(true);
    expect(problem.candidates.every((entry) => entry.evidence.kind === 'single-snapshot')).toBe(true);
  });

  it('exports goal conjunctions as independently parseable problem lines', () => {
    const result = exportAg2Problem(midpointProblem(), { acceptedIds: [], goalId: 'm-midpoint' });
    expect(result.value?.goals).toHaveLength(2);
    expect(result.value?.text.split('\n').every((line) => line.includes(' ? '))).toBe(true);
  });

  it('preserves modular factors and exact product constants', () => {
    const problem = midpointProblem();
    problem.candidates.push(candidate('algebra', [
      { kind: 'direction-equation', terms: [{ segment: ['a', 'b'], coefficient: 2 }, { segment: ['m', 'n'], coefficient: -2 }], constant: { numerator: 0, denominator: 1 } },
      { kind: 'length-product', terms: [{ segment: ['a', 'b'], coefficient: 1 }, { segment: ['a', 'm'], coefficient: -1 }], constant: { numerator: 2, denominator: 1 } },
    ]));
    const value = exportAg2Problem(problem, { acceptedIds: ['algebra'], goalId: null }).value!;
    expect(value.premise).toContain('2 -2 0');
    expect(value.premise).toContain('1 -1 1/2');
  });

  it('exports ordinary angle branches explicitly and rejects boundary angles', () => {
    const problem = midpointProblem();
    problem.candidates.push(candidate('angle', [{ kind: 'ordinary-angle-equation', terms: [
      { angle: ['b', 'a', 'c'], coefficient: 1 }, { angle: ['m', 'a', 'n'], coefficient: -1 },
    ], pi: { numerator: 0, denominator: 1 } }]));
    const value = exportAg2Problem(problem, { acceptedIds: ['angle'], goalId: null }).value!;
    expect(value.branches).toHaveLength(2);
    expect(value.premise).toContain('angeq');
    problem.candidates.push(candidate('boundary', [{ kind: 'ordinary-angle-equation', terms: [{ angle: ['a', 'm', 'b'], coefficient: 1 }], pi: { numerator: 1, denominator: 1 } }]));
    expect(exportAg2Problem(problem, { acceptedIds: ['boundary'], goalId: null }).errors[0]).toContain('boundary');
  });

  it('rejects poorly separated points and oversized coefficients', () => {
    const problem = midpointProblem();
    problem.objects[3].coordinates = { x: 0, y: 0 };
    expect(exportAg2Problem(problem, { acceptedIds: ['m-midpoint'], goalId: null }).value).toBeNull();
    problem.candidates.push(candidate('large', [{ kind: 'length-sum', terms: [{ segment: ['a', 'b'], coefficient: 33 }], constant: { numerator: 0, denominator: 1 } }]));
    expect(exportAg2Problem(problem, { acceptedIds: ['large'], goalId: null }).errors[0]).toContain('budget');
  });

  it('does not confuse an ordinary equation with one differing by pi', () => {
    const problem = midpointProblem();
    problem.objects[2].coordinates = { x: -1, y: 1 };
    problem.objects.push({ ...problem.objects[0], id: 'e', name: 'E', coordinates: { x: 0, y: 2 } });
    problem.candidates.push(candidate('wrong-lift', [{ kind: 'ordinary-angle-equation', terms: [
      { angle: ['b', 'a', 'c'], coefficient: 2 }, { angle: ['b', 'a', 'e'], coefficient: -1 },
    ], pi: { numerator: 0, denominator: 1 } }]));
    expect(exportAg2Problem(problem, { acceptedIds: [], goalId: 'wrong-lift' }).errors[0]).toContain('witness branch');
  });
});
