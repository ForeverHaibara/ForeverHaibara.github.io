import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GeometryReasoningView from '../reasoning/GeometryReasoningView';
import GeometryDiscoveryControls from './GeometryDiscoveryControls';
import { midpointConstruction } from '../../reasoning/__fixtures__/problems';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import { buildDependencyGraph } from '../../analysis/constructionGraph';
import { DEFAULT_DISCOVERY_OPTIONS, RELATION_GROUPS } from '../../analysis/relations/catalog';
import { defaultDiscoveryPreferences } from '../../analysis/preferences/discoveryPreferences';
import { buildCatalogEntries, defaultCatalogFilter, filterCatalogEntries, mergeRelationCatalog } from '../../reasoning/selection/relationCatalog';
import { createDiscoveryProblem } from '../../reasoning/sources/discoveryProblem';
import type { GeometryRelationsState } from '../../analysis/useGeometryRelations';
import type { ObjectLink } from '../../interaction/useObjectLink';
import type { GeoGebraEngine } from '../../types';

describe('unified relations and reasoning UI', () => {
  it('identifies groups skipped by a saved compute scope and offers to re-enable defaults', () => {
    const preferences = defaultDiscoveryPreferences();
    const state: GeometryRelationsState = { result: null, status: 'idle', error: null, preferences,
      setPreferences() {}, run() {}, stop() {}, stale: false, storageUnavailable: false };
    expect(renderToStaticMarkup(<GeometryDiscoveryControls state={state} />)).not.toContain('Enable default types and rerun');

    preferences.options.enabledKinds = ['directed-angles', 'dot-products', 'cross-products'];
    const html = renderToStaticMarkup(<GeometryDiscoveryControls state={state} />);
    expect(html).toContain('Discovery skips Basic, Lengths, Triangles, Generators under the current settings.');
    expect(html).toContain('Enable default types and rerun');
  });

  it('keeps all six groups accessible under the default result budget and shows a low-ranked collinearity on the first page', () => {
    // Chords on the same circle generate enough directed angles to fill the
    // old global top 500 before reaching the constructed collinearity.
    const ring = Array.from({ length: 16 }, (_, i) => {
      const angle = i * 0.38 + i * i * 0.00079;
      return { name: `P${i}`, objectType: 'point', commandString: '', coordinates: { x: Math.cos(angle), y: Math.sin(angle) } };
    });
    const similarTriangle = ring.slice(0, 3).map((point, i) => ({ ...point, name: ['D', 'E', 'F'][i],
      coordinates: { x: 20 + 2 * point.coordinates.x, y: 10 - 2 * point.coordinates.y } }));
    const graph = buildDependencyGraph([
      { name: 'A', objectType: 'point', commandString: '', coordinates: { x: 4, y: 2 } },
      { name: 'B', objectType: 'point', commandString: '', coordinates: { x: 8, y: 2 } },
      { name: 'C', objectType: 'point', commandString: 'A+3*(B-A)', coordinates: { x: 16, y: 2 } },
      ...ring,
      ...similarTriangle,
    ]);
    const result = detectGeometryRelations(graph, graph.generatedAt, DEFAULT_DISCOVERY_OPTIONS);
    expect(result.relations).toHaveLength(DEFAULT_DISCOVERY_OPTIONS.maxRelations);
    expect(result.relations.findIndex(({ id }) => id === 'collinear:A|B|C')).toBeGreaterThanOrEqual(100);
    const compact = detectGeometryRelations(graph, graph.generatedAt, { ...DEFAULT_DISCOVERY_OPTIONS, maxRelations: RELATION_GROUPS.length });
    expect(compact.relations).toHaveLength(RELATION_GROUPS.length);

    const { problem, aliases } = mergeRelationCatalog(createDiscoveryProblem(graph, result), null);
    const entries = buildCatalogEntries(problem, result.relations, aliases);
    const selection = { acceptedIds: [], goalId: null };
    const basic = RELATION_GROUPS.find(({ label }) => label === 'Basic')!.items.map(({ kind }) => kind);
    const filter = { ...defaultCatalogFilter(), view: 'all' as const, selectedNames: [] };
    for (const { label, items } of RELATION_GROUPS) {
      const kinds = items.map(({ kind }) => kind);
      expect(compact.relations.some(({ kind }) => kinds.includes(kind)), label).toBe(true);
      const filtered = filterCatalogEntries(entries, problem, selection, { ...filter, kinds });
      const searched = filterCatalogEntries(entries, problem, selection, { ...filter, search: label });
      expect(filtered.length, label).toBeGreaterThan(0);
      expect(searched, label).toEqual(filtered);
    }
    for (const options of [{ kinds: basic }, { search: '共线 ABC' }, { search: 'Basic ABC' }]) {
      const matching = filterCatalogEntries(entries, problem, selection, { ...filter, ...options });
      expect(matching.map(({ candidate }) => candidate.id)).toContain('collinear:A|B|C');
    }
    expect(filterCatalogEntries(entries, problem, selection, { ...filter, search: '共线 ∠ABC' })).toEqual([]);

    const discovery: GeometryRelationsState = { result, status: 'ready', error: null,
      preferences: defaultDiscoveryPreferences(), setPreferences() {}, run() {}, stop() {}, stale: false, storageUnavailable: false };
    const objectLink = { selectedNames: [] } as unknown as ObjectLink;
    const html = renderToStaticMarkup(<GeometryReasoningView engine={{} as GeoGebraEngine} graph={graph} graphStatus="ready" lastEventTime={0} discovery={discovery} objectLink={objectLink} />);
    expect(html).toContain('100 shown');
    expect(html).toContain('aria-label="Accept condition: A, B, C collinear"');
  });

  it.each([false, true])('keeps catalog controls usable on the current snapshot with pending discovery settings: %s', (stale) => {
    const graph = midpointConstruction();
    const state: GeometryRelationsState = { result: detectGeometryRelations(graph, 123), status: 'ready', error: null,
      preferences: defaultDiscoveryPreferences(), setPreferences() {}, run() {}, stop() {}, stale, storageUnavailable: false };
    const objectLink = { selectedNames: [], select() {}, hover() {}, focus() {} } as unknown as ObjectLink;
    const html = renderToStaticMarkup(<GeometryReasoningView engine={{} as GeoGebraEngine} graph={graph} graphStatus="ready" lastEventTime={0} discovery={state} objectLink={objectLink} />);
    expect(html.match(/aria-label="Search relations"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Relations catalog"/g)).toHaveLength(1);
    expect(html).not.toContain('Search condition candidates');
    expect(html).toContain('Accept condition:'); expect(html).toContain('Use as goal');
    expect(html).toContain('Generate readable proof'); expect(html).toContain('Discover relations');
    expect(html).toContain('Accepted (0)'); expect(html).toContain('Goal (0)');
    expect(html).toContain('Discovery settings'); expect(html).toContain('List filters');
    expect(html).toContain('Reset filters'); expect(html).not.toContain('Show:');
    expect(html).toContain('Each view remembers its own filters');
    const actions = html.slice(html.indexOf('aria-label="Proof workspace"'), html.indexOf('Suggestions are added automatically.'));
    expect(actions).toContain('Suggest conditions'); expect(actions).toContain('Generate readable proof');
    expect(actions).not.toContain('<details');
    expect(html.indexOf('aria-label="Proof workspace"')).toBeLessThan(html.indexOf('Discovery settings'));
    expect(html).toContain('Reasoning options'); expect(html).not.toContain('clears the goal');
    const conditions = html.match(/<input[^>]+aria-label="Accept condition: [^"]*"[^>]*>/g) ?? [];
    expect(conditions.some((input) => !input.includes('disabled'))).toBe(true);
  });
});
