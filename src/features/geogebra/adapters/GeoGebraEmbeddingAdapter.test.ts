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

it('reports visual XML updates as styles instead of rebuilding the analysis graph', async () => {
  let update!: (name: string) => void;
  const evalXML = vi.fn(() => update('c'));
  const { container } = mockEmbedding({ evalXML, registerUpdateListener: (listener: typeof update) => { update = listener; } });
  const engine = new GeoGebraEmbeddingAdapter();
  const events = vi.fn(); engine.subscribe(events);
  await engine.initialize(container);
  await engine.updateStyleXml('c', '<element type="conic" label="c"><lineStyle opacity="102"/></element>');
  expect(events).toHaveBeenCalledOnce();
  expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'style', objectName: 'c' }));
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

it('uses native selection without style edits and prevents selection feedback loops', async () => {
  let client!: (event: { type: string; target?: string }) => void;
  let storeUndo!: () => void;
  const evalCommand = vi.fn(() => { client({ type: 'deselect' }); client({ type: 'select', target: 'A' }); storeUndo(); return false; });
  const { container } = mockEmbedding({
    getAllObjectNames: () => ['A'], evalCommand,
    registerClientListener: (listener: typeof client) => { client = listener; },
    registerStoreUndoListener: (listener: () => void) => { storeUndo = listener; },
  });
  const engine = new GeoGebraEmbeddingAdapter();
  const interaction = vi.fn(), construction = vi.fn();
  engine.subscribeInteraction(interaction);
  engine.subscribe(construction);
  await engine.initialize(container);
  await engine.selectObjects(['A']);
  expect(evalCommand).toHaveBeenCalledWith('SelectObjects(A)');
  expect(interaction).not.toHaveBeenCalled();
  expect(construction).not.toHaveBeenCalled();
  client({ type: 'select', target: 'A' });
  expect(interaction).toHaveBeenCalledWith({ type: 'select', objectName: 'A' });
  await expect(engine.selectObjects(['A)\nDelete(A'])).rejects.toThrow();
  expect(evalCommand).toHaveBeenCalledTimes(1);
  engine.dispose();
});

const engineWith = (applet: Record<string, unknown>) => {
  const engine = new GeoGebraEmbeddingAdapter();
  Object.assign(engine, { applet });
  return engine;
};

it('keeps keyboard focus in Analysis after a native selection preview', async () => {
  const focus = vi.fn();
  const original = { isConnected: true, focus };
  const documentMock = { activeElement: original as unknown };
  vi.stubGlobal('document', documentMock);
  const engine = engineWith({ getAllObjectNames: () => ['A'], evalCommand: () => { documentMock.activeElement = {}; return false; } });
  await engine.selectObjects(['A']);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  engine.dispose();
});

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
