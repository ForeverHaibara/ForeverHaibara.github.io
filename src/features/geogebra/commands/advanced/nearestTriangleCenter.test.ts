import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../../types';
import { advancedCommands } from '../advancedCommands';
import { getCompletionContext } from '../completion/completionContext';
import { studioCompletionRegistry } from '../completion/studioCompletionRegistry';
import fixture from './triangleCenterNumerics.fixture.json';
const mockEngine = (overrides: Record<string, unknown> = {}, target = [7 / 3, 4 / 3], native: Record<string, number[]> = {2: [7 / 3, 4 / 3]}) => {
  const points: Record<string, number[]> = { A: [0, 0], B: [6, 0], C: [1, 4], P: target };
  const callApi = vi.fn(async (method: string, args: unknown[]) => {
    if (method in overrides)
      return overrides[method];
    const name = String(args[0]);
    if (method === 'getObjectType')
      return points[name] ? 'point' : '';
    if (method === 'isDefined')
      return Boolean(points[name]);
    if (method === 'getXcoord')
      return points[name][0];
    if (method === 'getYcoord')
      return points[name][1];
    if (method === 'getValue') {
      const id = Number(name.match(/,(\d+)\)\)/u)?.[1]);
      // Anonymous native coordinates in the normalized (scale 6) snapshot.
      if (native[id])
        return native[id][name.includes(',x(') ? 0 : 1] / 6;
      return NaN;
    }
    throw new Error(`Unexpected mutation/API: ${method}`);
  });
  return { engine: { callApi } as unknown as GeoGebraEngine, callApi };
};
describe('nearestTriangleCenter advanced command', () => {
  it('searches the catalogue, skips undefined entries and returns an immediate value using read APIs only', async () => {
    const { engine, callApi } = mockEngine();
    const result = await advancedCommands.execute(engine, '!nearestTriangleCenter(A,B,C,P)') as {
      id: number;
      distance: number;
      point: {
        x: number;
        y: number;
      };
      evaluated: number;
      skipped: number;
    };
    expect(result.id).toBe(2);
    expect(result.distance).toBeLessThan(1e-14);
    expect(result.point.x).toBeCloseTo(7 / 3);
    expect(result.point.y).toBeCloseTo(4 / 3);
    expect(result.evaluated).toBeGreaterThan(1);
    expect(result.skipped).toBeGreaterThan(1000);
    expect(callApi.mock.calls.every(([method]) => ['getObjectType', 'isDefined', 'getXcoord', 'getYcoord', 'getValue'].includes(method))).toBe(true);
  });
  it('can select an extended Gemini center rather than a native center', async () => {
    const target = fixture.expected.acute['29919'];
    const { engine } = mockEngine({}, target, fixture.native.acute);
    const result = await advancedCommands.execute(engine, '!nearestTriangleCenter(A,B,C,P)') as {id: number; distance: number};
    expect(result.id).toBe(29919);
    expect(result.distance).toBeLessThan(1e-8);
  });
  it('rejects invalid arguments and degenerate triangles before scanning', async () => {
    const { engine, callApi } = mockEngine();
    await expect(advancedCommands.execute(engine, '!nearestTriangleCenter(A,B,C)')).rejects.toThrow('four existing');
    await expect(advancedCommands.execute(engine, '!nearestTriangleCenter(A,B,C,missing)')).rejects.toThrow('defined 2D point');
    await expect(advancedCommands.execute(engine, '!nearestTriangleCenter(A,A,C,P)')).rejects.toThrow('nondegenerate');
    expect(callApi.mock.calls.some(([m]) => m === 'getValue')).toBe(false);
    await expect(advancedCommands.execute(mockEngine({ isDefined: false }).engine, '!nearestTriangleCenter(A,B,C,P)')).rejects.toThrow('defined 2D point');
  });
  it('offers the command and signature only in the exclamation command namespace', async () => {
    const context = getCompletionContext('!nearest', 8)!;
    const items = await studioCompletionRegistry.complete(context, new AbortController().signal);
    expect(items.find((item) => item.label === 'nearestTriangleCenter')?.signatures).toEqual(['nearestTriangleCenter(A: point, B: point, C: point, P: point)']);
    const normal = await studioCompletionRegistry.complete(getCompletionContext('nearest', 7)!, new AbortController().signal);
    expect(normal.some((item) => item.label === 'nearestTriangleCenter')).toBe(false);
  });
});
