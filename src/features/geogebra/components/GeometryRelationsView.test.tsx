import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GeometryReasoningView from './GeometryReasoningView';
import { midpointConstruction } from '../reasoning/__fixtures__/problems';
import { detectGeometryRelations } from '../analysis/geometryRelations';
import { defaultDiscoveryPreferences } from '../analysis/preferences/discoveryPreferences';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import type { ObjectLink } from '../interaction/useObjectLink';
import type { GeoGebraEngine } from '../types';

describe('unified relations and reasoning UI', () => {
  it('renders one search and one catalog with per-card condition and goal controls', () => {
    const graph = midpointConstruction();
    const state: GeometryRelationsState = { result: detectGeometryRelations(graph, 123), status: 'ready', error: null,
      preferences: defaultDiscoveryPreferences(), setPreferences() {}, run() {}, stop() {}, stale: false, storageUnavailable: false };
    const objectLink = { selectedNames: [], select() {}, hover() {}, focus() {} } as unknown as ObjectLink;
    const html = renderToStaticMarkup(<GeometryReasoningView engine={{} as GeoGebraEngine} graph={graph} graphStatus="ready" lastEventTime={0} discovery={state} objectLink={objectLink} />);
    expect(html.match(/aria-label="Search relations"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Relations catalog"/g)).toHaveLength(1);
    expect(html).not.toContain('Search condition candidates');
    expect(html).toContain('Accept condition:'); expect(html).toContain('Use as goal');
    expect(html).toContain('Generate readable proof'); expect(html).toContain('Discover relations');
    expect(html).toContain('Accepted (0)'); expect(html).toContain('Goal (0)');
  });
});
