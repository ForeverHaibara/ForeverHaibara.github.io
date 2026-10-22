import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../types';
import { GeoGebraConstructionSource } from './constructionSource';

describe('full precision construction coordinates', () => {
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
