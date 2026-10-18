import { describe, expect, it, vi } from 'vitest';
import type { EngineEventListener, GeoGebraEngine, GeometryInteractionEvent } from '../types';
import { ObjectLinkController } from './ObjectLinkController';

function fixture() {
  let interaction!: (event: GeometryInteractionEvent) => void;
  let construction!: EngineEventListener;
  const selectObjects = vi.fn().mockResolvedValue(undefined);
  const unsubscribe = vi.fn();
  const engine = {
    selectObjects,
    subscribeInteraction(listener: typeof interaction) { interaction = listener; return unsubscribe; },
    subscribe(listener: EngineEventListener) { construction = listener; return unsubscribe; },
  } as unknown as GeoGebraEngine;
  const controller = new ObjectLinkController(engine);
  const disconnect = controller.connect();
  return { controller, selectObjects, disconnect, unsubscribe,
    native: (event: GeometryInteractionEvent) => interaction(event),
    geometry: (event: Parameters<EngineEventListener>[0]) => construction(event),
  };
}

describe('linked object selection', () => {
  it('tracks native multi-selection and restores it when a hover preview ends', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.native({ type: 'select', objectName: 'B' });
    f.controller.hover('c');
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenLastCalledWith(['c']);
    expect(f.controller.getSnapshot().selectedNames).toEqual(['A', 'B']);
    f.controller.hover(null);
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenLastCalledWith(['A', 'B']);
    expect(f.controller.getSnapshot().hoveredName).toBeNull();
    f.disconnect();
  });

  it('lets a graph click commit a preview and a second click clear it', async () => {
    const f = fixture();
    f.controller.hover('A');
    f.controller.select('A');
    f.controller.hover(null);
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenLastCalledWith(['A']);
    f.controller.select('A');
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenLastCalledWith([]);
    expect(f.controller.getSnapshot().selectedNames).toEqual([]);
    f.disconnect();
  });

  it('coalesces obsolete hover writes and does not overwrite a newer native selection', async () => {
    const f = fixture();
    f.controller.hover('A');
    f.controller.hover('B');
    f.controller.hover('C');
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenCalledTimes(1);
    expect(f.selectObjects).toHaveBeenLastCalledWith(['C']);
    f.controller.hover('D');
    f.native({ type: 'deselect' });
    f.native({ type: 'select', objectName: 'E' });
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot()).toMatchObject({ selectedNames: ['E'], hoveredName: null, source: 'canvas' });
    f.disconnect();
  });

  it('clears both sides after native deselection or loading another construction', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.native({ type: 'select', objectName: 'B' });
    f.native({ type: 'deselect', objectName: 'A' });
    expect(f.controller.getSnapshot().selectedNames).toEqual(['B']);
    f.controller.hover('c');
    f.geometry({ type: 'clear', timestamp: 0 });
    await f.controller.settle();
    expect(f.controller.getSnapshot()).toMatchObject({ selectedNames: [], hoveredName: null });
    expect(f.selectObjects).not.toHaveBeenCalled();
    f.disconnect();
  });

  it('follows renames and forgets deleted objects', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.geometry({ type: 'rename', previousName: 'A', objectName: 'P', timestamp: 0 });
    expect(f.controller.getSnapshot().selectedNames).toEqual(['P']);
    f.geometry({ type: 'remove', objectName: 'P', timestamp: 0 });
    expect(f.controller.getSnapshot().selectedNames).toEqual([]);
    f.disconnect();
  });

  it('restores a native selection when unmounted during a preview', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.controller.hover('B');
    await f.controller.settle();
    f.disconnect();
    expect(f.selectObjects).toHaveBeenLastCalledWith(['A']);
    expect(f.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('restores the previous selection if a previewed object is deleted', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.controller.hover('B');
    await f.controller.settle();
    f.geometry({ type: 'remove', objectName: 'B', timestamp: 0 });
    await f.controller.settle();
    expect(f.selectObjects).toHaveBeenLastCalledWith(['A']);
    f.disconnect();
  });

  it('honors a native deselect targeting the preview rather than the saved selection', async () => {
    const f = fixture();
    f.native({ type: 'select', objectName: 'A' });
    f.controller.hover('B');
    await f.controller.settle();
    f.native({ type: 'deselect', objectName: 'B' });
    f.controller.hover(null);
    await f.controller.settle();
    expect(f.controller.getSnapshot()).toMatchObject({ selectedNames: [], hoveredName: null });
    expect(f.selectObjects).toHaveBeenCalledTimes(1);
    f.disconnect();
  });

  it('reports an unsupported native operation without leaking a rejected promise', async () => {
    const f = fixture();
    f.selectObjects.mockRejectedValueOnce(new Error('Selection unavailable'));
    f.controller.select('A');
    await f.controller.settle();
    expect(f.controller.getSnapshot().error).toBe('Selection unavailable');
    f.disconnect();
  });

  it('does not start a redundant preview when focusing the only selected object', async () => {
    const f = fixture();
    f.controller.select('A');
    await f.controller.settle();
    f.controller.hover('A');
    await f.controller.settle();
    expect(f.controller.getSnapshot().hoveredName).toBeNull();
    expect(f.selectObjects).toHaveBeenCalledTimes(1);
    f.disconnect();
  });
});
