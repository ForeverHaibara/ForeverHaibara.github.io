import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../../types';
import { midpointProblem } from '../__fixtures__/problems';
import { sampleConstruction } from './sampleConstruction';

const setup = async () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const frame = { style: {}, contentWindow: { postMessage: vi.fn() }, setAttribute: vi.fn(), remove: vi.fn() };
  const append = vi.fn();
  vi.stubGlobal('window', { location: { origin: 'https://example.test' }, crypto: { randomUUID: () => 'test-token' },
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    addEventListener: (_type: string, callback: (event: MessageEvent) => void) => listeners.add(callback),
    removeEventListener: (_type: string, callback: (event: MessageEvent) => void) => listeners.delete(callback) });
  vi.stubGlobal('document', { createElement: () => frame, body: { append } });
  const callApi = vi.fn(async (_name: string, args: unknown[]) => ['A', 'B', 'C'].includes(String(args[0])));
  const exportGgb = vi.fn(async () => new Blob(['replica']));
  const engine = { callApi, exportGgb } as unknown as GeoGebraEngine;
  const controller = new AbortController(); const progress = vi.fn();
  const result = sampleConstruction(engine, midpointProblem(), controller.signal, progress);
  // Wait for read-only API calls and the Blob conversion, without real network or timers.
  await vi.waitFor(() => expect(append).toHaveBeenCalledOnce());
  const message = (data: object, overrides: object = {}) => {
    const event = { source: frame.contentWindow, origin: 'https://example.test',
      data: { channel: 'geometry-sampling-v1', token: 'test-token', ...data }, ...overrides } as unknown as MessageEvent;
    for (const receive of listeners) receive(event);
  };
  return { frame, listeners, callApi, exportGgb, controller, progress, result, message };
};

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('isolated construction sampling lifecycle', () => {
  it('removes the replica and listeners when cancelled; never mutates the live API', async () => {
    const task = await setup();
    const rejection = expect(task.result).rejects.toThrow('stopped');
    task.controller.abort(); await rejection;
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
    expect(task.callApi.mock.calls.every(([name]) => ['isIndependent', 'isMoveable'].includes(name))).toBe(true);
    expect(task.exportGgb).toHaveBeenCalledOnce();
    task.message({ samples: [] });
    expect(task.progress).not.toHaveBeenCalled();
  });

  it('accepts only messages from this frame, origin and run token', async () => {
    const task = await setup();
    task.message({ ready: true });
    expect(task.frame.contentWindow.postMessage).toHaveBeenCalledOnce();
    task.message({ progress: 1 }, { source: null });
    task.message({ progress: 1 }, { origin: 'https://other.test' });
    task.message({ progress: 1, token: 'stale-token' });
    expect(task.progress).not.toHaveBeenCalled();
    task.message({ progress: 2 });
    expect(task.progress).toHaveBeenCalledWith(2);
    task.message({ samples: [] });
    expect((await task.result).variedPointIds).toEqual(['a', 'b', 'c']);
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
  });

  it('rejects an undefined replica baseline and releases its resources', async () => {
    const task = await setup();
    const rejection = expect(task.result).rejects.toThrow('did not reproduce');
    task.message({ baseline: { a: { x: NaN, y: 0 } } });
    await rejection;
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
  });

  it('cleans up after the replica exceeds its time budget', async () => {
    vi.useFakeTimers(); const task = await setup();
    const rejection = expect(task.result).rejects.toThrow('time budget');
    await vi.advanceTimersByTimeAsync(45000); await rejection;
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
  });
});
