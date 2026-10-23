import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../../types';
import { midpointConstruction, midpointProblem } from '../__fixtures__/problems';
import { sampleConstruction } from './sampleConstruction';
import { REPLICA_SNAPSHOT_WARNING } from './types';
import { proposeConditions } from '../selection/proposeConditions';
import { DEFAULT_CHARACTERIZATION_OPTIONS } from '../selection/types';
import { acceptSuggestedConditions } from '../selection/relationCatalog';

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

  it.each([
    { a: { x: NaN, y: 0 } },
    Object.fromEntries(midpointProblem().objects.map((point) => [point.id, { x: point.coordinates!.x + 1, y: point.coordinates!.y }])),
  ])('keeps provisional conditions when the replica baseline is undefined or differs: %j', async (baseline) => {
    const task = await setup();
    task.message({ baseline });
    const sampling = await task.result;
    expect(sampling).toMatchObject({ baselineMatched: false, samples: [], diagnostics: [REPLICA_SNAPSHOT_WARNING] });
    // The normal search/accept path continues with the original graph, never
    // treating the mismatched copy as successful multi-configuration evidence.
    const proposal = proposeConditions(midpointConstruction(), DEFAULT_CHARACTERIZATION_OPTIONS, sampling);
    expect(proposal.coreIds).toHaveLength(2);
    expect(proposal.diagnostics).toContain(REPLICA_SNAPSHOT_WARNING);
    expect(proposal.problem.candidates.filter((candidate) => proposal.coreIds.includes(candidate.id)).every((candidate) => candidate.evidence.kind === 'single-snapshot')).toBe(true);
    const goal = proposal.problem.candidates.find((candidate) => candidate.id === proposal.coreIds[0])!.id;
    const selection = acceptSuggestedConditions({ acceptedIds: [], goalId: goal }, proposal.coreIds, proposal.problem, new Map());
    expect(selection.goalId).toBe(goal);
    expect(selection.acceptedIds).toEqual([proposal.coreIds[1]]);
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
    task.message({ samples: [{ coordinates: { wrong: { x: 999, y: 999 } } }] });
    expect(sampling.samples).toEqual([]);
    expect(task.callApi.mock.calls.every(([name]) => ['isIndependent', 'isMoveable'].includes(name))).toBe(true);
  });

  it('retains replica evidence when its baseline matches the current snapshot', async () => {
    const task = await setup();
    task.message({ baseline: Object.fromEntries(midpointProblem().objects.map((point) => [point.id, point.coordinates])) });
    const samples = [{ index: 0, phase: 'discovery', coordinates: { a: { x: 1, y: 2 } } }];
    task.message({ samples });
    expect(await task.result).toMatchObject({ baselineMatched: true, samples, diagnostics: [] });
    expect(task.frame.remove).toHaveBeenCalledOnce();
  });

  it('cleans up after the replica exceeds its time budget', async () => {
    vi.useFakeTimers(); const task = await setup();
    const rejection = expect(task.result).rejects.toThrow('time budget');
    await vi.advanceTimersByTimeAsync(45000); await rejection;
    expect(task.frame.remove).toHaveBeenCalledOnce();
    expect(task.listeners.size).toBe(0);
  });
});
