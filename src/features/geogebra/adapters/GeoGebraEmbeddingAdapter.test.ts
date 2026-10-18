import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeoGebraEmbeddingAdapter } from './GeoGebraEmbeddingAdapter';
vi.mock('./GeoGebraScriptLoader', () => ({ loadGeoGebraScript: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => vi.unstubAllGlobals());

function mockEmbedding(api: Record<string, unknown>) {
  const inject = vi.fn();
  class Applet {
    constructor(private params: { appletOnLoad(api: Record<string, unknown>): void }) {}
    inject() { inject(); this.params.appletOnLoad(api); }
  }
  vi.stubGlobal('window', { GGBApplet: Applet, setTimeout, clearTimeout });
  const container = { style: {}, replaceChildren: vi.fn(), parentElement: { getBoundingClientRect: () => ({ width: 800, height: 600 }) } } as unknown as HTMLElement;
  return { container, inject };
}

it('cancels a disposed initialization before it can inject a second applet', async () => {
  const { container, inject } = mockEmbedding({});
  const engine = new GeoGebraEmbeddingAdapter();
  const obsolete = engine.initialize(container);
  engine.dispose();
  await Promise.all([obsolete, engine.initialize(container)]);
  expect(inject).toHaveBeenCalledOnce();
  engine.dispose();
});

it('reports native style undo records so autosave also sees edits without object updates', async () => {
  const registerStoreUndoListener = vi.fn();
  const unregisterStoreUndoListener = vi.fn();
  const { container } = mockEmbedding({ registerStoreUndoListener, unregisterStoreUndoListener });
  const engine = new GeoGebraEmbeddingAdapter();
  const listener = vi.fn();
  engine.subscribe(listener);
  await engine.initialize(container);
  const onUndo = registerStoreUndoListener.mock.calls[0][0] as () => void;
  onUndo();
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
  engine.dispose();
  expect(unregisterStoreUndoListener).toHaveBeenCalledWith(onUndo);
});

const engineWith = (applet: Record<string, unknown>) => {
  const engine = new GeoGebraEmbeddingAdapter();
  Object.assign(engine, { applet });
  return engine;
};

describe('GeoGebra command module loading', () => {
  it('removes the applet on disposal so reset cannot retain its imported tools', () => {
    const remove = vi.fn();
    const engine = engineWith({ remove });
    engine.dispose();
    engine.dispose();
    expect(remove).toHaveBeenCalledOnce();
  });
  it('waits for the async evaluator instead of prematurely rejecting an advanced command', async () => {
    const sync = vi.fn();
    const asyncEvalCommandGetLabels = vi.fn().mockResolvedValue('I');
    const result = await engineWith({ asyncEvalCommandGetLabels, evalCommandGetLabels: sync }).executeCommand('I=TriangleCenter(A,B,C,1)');
    expect(result.success).toBe(true);
    expect(result.labels).toEqual(['I']);
    expect(sync).not.toHaveBeenCalled();
  });

  it('does not retry a rejected construction', async () => {
    const asyncEvalCommandGetLabels = vi.fn().mockRejectedValue(new Error('Invalid arguments'));
    const sync = vi.fn();
    const result = await engineWith({ asyncEvalCommandGetLabels, evalCommandGetLabels: sync }).executeCommand('Broken(A)');
    expect(result.error).toBe('Invalid arguments');
    expect(asyncEvalCommandGetLabels).toHaveBeenCalledOnce();
    expect(sync).not.toHaveBeenCalled();
  });

  it('retains synchronous evaluation on older engines', async () => {
    const evalCommandGetLabels = vi.fn().mockReturnValue('A,B');
    const result = await engineWith({ evalCommandGetLabels }).executeCommand('Intersect(l,c)');
    expect(result.labels).toEqual(['A', 'B']);
  });
});
