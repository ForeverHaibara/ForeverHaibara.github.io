import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../types';
import { GeoGebraConstructionSource } from './constructionSource';
import { buildDependencyGraph, collapseInternalHelpers } from './constructionGraph';

describe('full precision construction coordinates', () => {
  it('verifies auxiliary points before reading coordinates and excludes them from discovery', async () => {
    const helper = 'ggbaux0123456789abcdefnv1';
    const xml = `<element type="point" label="${helper}"><auxiliary val="true" /></element>`;
    const callApi = vi.fn(async (method: string, args: unknown[]) => {
      const name = String(args[0]);
      if (method === 'getAllObjectNames') return ['A', helper, 'out'];
      if (method === 'getXML') return xml;
      if (method === 'getObjectType') return 'point';
      if (method === 'getCommandString') return name === helper ? 'Midpoint(A,A)' : name === 'out' ? `Midpoint(${helper},A)` : '';
      if (method === 'getXcoord') return 0;
      if (method === 'getYcoord') return 0;
      throw new Error(method);
    });
    const snapshot = await new GeoGebraConstructionSource({ callApi } as unknown as GeoGebraEngine).read();
    expect(snapshot.objects.find((object) => object.name === helper)?.internalHelper).toBe(true);
    expect(callApi.mock.calls.some(([method, args]) => ['getXcoord', 'getYcoord'].includes(method) && args[0] === helper)).toBe(false);
    const graph = collapseInternalHelpers(buildDependencyGraph(snapshot.objects));
    expect(graph.nodes.map((node) => node.name)).not.toContain(helper);
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'object:A', target: 'object:out' }));
  });
  it('uses native doubles even when point definitions and display strings are rounded', async () => {
    const x = 1 / 3; const y = Math.sqrt(2);
    const callApi = vi.fn(async (method: string) => ({ getAllObjectNames: ['P'], getObjectType: 'point',
      getCommandString: '(0.33, 1.41)', getValueString: 'P = (0.33, 1.41)', getXcoord: x, getYcoord: y })[method]);
    const snapshot = await new GeoGebraConstructionSource({ callApi } as unknown as GeoGebraEngine).read();
    expect(snapshot.objects[0].coordinates).toEqual({ x, y });
    expect(snapshot.objects[0].coordinates?.x).not.toBe(0.33);
    expect(callApi.mock.calls.some(([method]) => method === 'getValueString' || method === 'setRounding')).toBe(false);
  });

  it.each(['', '0.33', NaN, Infinity, null])('rejects a missing or non-native coordinate (%s)', async (x) => {
    const callApi = vi.fn(async (method: string) => ({ getAllObjectNames: ['P'], getObjectType: 'point',
      getCommandString: '(0, 1)', getXcoord: x, getYcoord: 1 })[method]);
    const snapshot = await new GeoGebraConstructionSource({ callApi } as unknown as GeoGebraEngine).read();
    expect(snapshot.objects[0].coordinates).toBeUndefined();
    expect(snapshot.diagnostics.join(' ')).toContain('getXcoord(P)');
  });
});
