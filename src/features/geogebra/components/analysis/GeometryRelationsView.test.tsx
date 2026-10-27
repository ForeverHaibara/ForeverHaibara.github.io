import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GeometryReasoningView from '../reasoning/GeometryReasoningView';
import { midpointConstruction } from '../../reasoning/__fixtures__/problems';
import { detectGeometryRelations } from '../../analysis/geometryRelations';
import { defaultDiscoveryPreferences } from '../../analysis/preferences/discoveryPreferences';
import type { GeometryRelationsState } from '../../analysis/useGeometryRelations';
import type { ObjectLink } from '../../interaction/useObjectLink';
import type { GeoGebraEngine } from '../../types';

describe('unified relations and reasoning UI', () => {
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
