import { describe, expect, it } from 'vitest';
import { candidate, discoveredMidpointProblem, midpointProblem } from '../__fixtures__/problems';
import { exportAg2Proof } from '../backends/ag2/exportProblem';
import { buildCatalogEntries, filterCatalogEntries, mergeRelationCatalog, predicateIdentity, resolveCatalogIds, retainCatalogSelection } from './relationCatalog';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import { midpointConstruction } from '../__fixtures__/problems';
import { DEFAULT_DISCOVERY_OPTIONS } from '../../analysis/relations/catalog';

describe('single relation catalog', () => {
  it('merges equivalent observations and sampled suggestions and resolves old proposal IDs', () => {
    const base = midpointProblem();
    const local = { ...base, candidates: [candidate('local-M', [{ kind: 'midpoint', point: 'm', segment: ['b', 'a'] }])] };
    local.candidates[0].evidence = { kind: 'sampled', seed: 7, discoverySamples: 4, holdoutSamples: 2, skippedSamples: 0 };
    const catalog = mergeRelationCatalog(base, local);
    expect(catalog.problem!.candidates).toHaveLength(base.candidates.length);
    expect(resolveCatalogIds(['local-M', 'm-midpoint'], catalog.aliases)).toEqual(['m-midpoint']);
    expect(catalog.problem!.candidates.find((entry) => entry.id === 'm-midpoint')!.evidence.kind).toBe('sampled');
    const payload = exportAg2Proof(catalog.problem!, { acceptedIds: resolveCatalogIds(['local-M', 'n-midpoint'], catalog.aliases), goalId: 'midsegment' });
    expect(payload.errors).toEqual([]);
    expect(payload.value!.acceptedIds).toEqual(['m-midpoint', 'n-midpoint']);
    expect(payload.value!.premise).not.toContain('para');
  });

  it('retains sampling rejection and explicit override eligibility on a merged observation', () => {
    const base = midpointProblem(); const rejected = candidate('local-M', base.candidates[0].predicates);
    rejected.diagnostics = ['Counterexample in held-out configuration']; rejected.hypothesisEligible = true;
    const catalog = mergeRelationCatalog(base, { ...base, candidates: [rejected] });
    const entry = catalog.problem!.candidates.find((item) => item.id === 'm-midpoint')!;
    expect(entry.hypothesisEligible).toBe(true);
    expect(entry.diagnostics).toEqual(rejected.diagnostics);
    expect(exportAg2Proof(catalog.problem!, { acceptedIds: [entry.id], goalId: null }).value).toBeNull();
    expect(exportAg2Proof(catalog.problem!, { acceptedIds: [entry.id], goalId: null, assumptionMode: 'hypothetical' }).value).not.toBeNull();
  });

  it('does not conflate conjunctions, doubled modular conditions or ordinary angles with directed ones', () => {
    const a = { kind: 'directed-angle-equation' as const, terms: [{ angle: ['b', 'a', 'c'] as [string, string, string], coefficient: 1 }], pi: { numerator: 0, denominator: 1 } };
    expect(predicateIdentity(a)).not.toBe(predicateIdentity({ ...a, terms: [{ ...a.terms[0], coefficient: 2 }] }));
    expect(predicateIdentity(a)).not.toBe(predicateIdentity({ ...a, kind: 'ordinary-angle-equation' }));
    const base = midpointProblem();
    const local = { ...base, candidates: [candidate('compound', [...base.candidates[0].predicates, ...base.candidates[1].predicates])] };
    expect(mergeRelationCatalog(base, local).problem!.candidates).toHaveLength(base.candidates.length + 1);
  });

  it('retains local selections when discovery later supplies the equivalent row, but drops changed predicates', () => {
    const base = midpointProblem();
    const local = { ...base, candidates: [candidate('local-M', [{ kind: 'midpoint', point: 'm', segment: ['b', 'a'] }])] };
    const merged = mergeRelationCatalog(base, local);
    const selection = { acceptedIds: ['local-M'], goalId: 'local-M', assumptionMode: 'hypothetical' as const };
    expect(retainCatalogSelection(selection, local, merged.problem!, merged.aliases)).toEqual({ ...selection, acceptedIds: ['m-midpoint'], goalId: 'm-midpoint' });
    const changed = { ...base, candidates: [candidate('m-midpoint', [{ kind: 'midpoint', point: 'm', segment: ['a', 'c'] }])] };
    expect(retainCatalogSelection(selection, local, changed, merged.aliases)).toEqual({ ...selection, acceptedIds: [], goalId: null });
  });

  it('allows viewing accepted or goal relations hidden by display and object filters without changing the export', () => {
    const graph = midpointConstruction();
    const discovery = detectGeometryRelations(graph, 123, { ...DEFAULT_DISCOVERY_OPTIONS, compressConsequences: false });
    const base = discoveredMidpointProblem(); const catalog = mergeRelationCatalog(base, null);
    const entry = base.candidates.find((item) => item.predicates.some((predicate) => predicate.kind === 'midpoint'))!;
    const selection = { acceptedIds: [entry.id], goalId: entry.id };
    const entries = buildCatalogEntries(catalog.problem, discovery.relations, catalog.aliases);
    const filter = { view: 'all' as const, search: '', minimumValue: 100, visibleKinds: [], computedKinds: [], selectedOnly: true, selectedNames: ['unrelated'] };
    expect(filterCatalogEntries(entries, catalog.problem, selection, filter)).toEqual([]);
    expect(filterCatalogEntries(entries, catalog.problem, selection, { ...filter, view: 'accepted' }).map((item) => item.candidate.id)).toEqual([entry.id]);
    expect(filterCatalogEntries(entries, catalog.problem, selection, { ...filter, view: 'goal' }).map((item) => item.candidate.id)).toEqual([entry.id]);
    expect(selection.acceptedIds).toEqual([entry.id]);
  });
});
