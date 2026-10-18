import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenceController } from './PreferenceController';
import { DEFAULT_GGB_PREFERENCES } from './defaults';
import { normalizePreferences } from './preferenceStore';
import type { EngineEventListener, GeoGebraEngine, GeometryEvent } from '../types';

type ObjectState = { type: string; label: boolean; size: number; color: string };
function fixture(objects: Record<string, ObjectState> = {}) {
  const listeners = new Set<EngineEventListener>();
  const callApi = vi.fn(async (method: string, args: unknown[]) => {
    const [name, value] = args;
    const object = objects[String(name)];
    if (method === 'getAllObjectNames') return Object.keys(objects);
    if (method === 'getObjectType') return object?.type ?? '';
    if (method === 'getLabelVisible') return object.label;
    if (method === 'getColor') return object.color;
    if (method === 'getPointSize' || method === 'getLineThickness') return object.size;
    if (method === 'setLabelVisible') object.label = Boolean(value);
    if (method === 'setPointSize' || method === 'setLineThickness') object.size = Number(value);
    if (method === 'setColor') object.color = `#${args.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    return undefined;
  });
  const engine = {
    callApi,
    subscribe(listener: EngineEventListener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  } as unknown as GeoGebraEngine;
  const errors = vi.fn();
  const controller = new PreferenceController(engine, { ...DEFAULT_GGB_PREFERENCES }, errors);
  const emit = (type: GeometryEvent['type'], objectName?: string, previousName?: string) => listeners.forEach((listener) => listener({ type, objectName, previousName, timestamp: 0 }));
  return { objects, controller, engine, callApi, errors, emit };
}
const point = (): ObjectState => ({ type: 'point', label: false, size: 2, color: '#000000' });
const line = (type = 'line'): ObjectState => ({ type, label: true, size: 1, color: '#000000' });
afterEach(() => vi.useRealTimers());

describe('GeoGebra preferences lifecycle and ownership', () => {
  it('applies a graphics-only perspective, rounding, hidden axes/grid and curve labels after loading', async () => {
    const f = fixture({ A: point(), c: line('conic'), f: line('function'), curve: line('curvecartesian'), text: line('text') });
    await f.controller.loadDocument(async () => undefined);
    expect(f.callApi).toHaveBeenCalledWith('setPerspective', ['G']);
    expect(f.callApi).toHaveBeenCalledWith('setAxesVisible', [1, false, false, false]);
    expect(f.callApi).toHaveBeenCalledWith('setGridVisible', [1, false]);
    expect(f.callApi).toHaveBeenCalledWith('setRounding', ['5d']);
    expect(f.objects.A).toMatchObject({ label: true, size: 5, color: '#2563eb' });
    for (const key of ['c', 'f', 'curve']) expect(f.objects[key]).toMatchObject({ label: false, size: 3, color: '#475569' });
    expect(f.objects.text).toEqual(line('text'));
    f.controller.dispose();
  });

  it('preserves each individually edited property while updating managed properties', async () => {
    const f = fixture({ A: point(), B: point(), l: line() });
    await f.controller.loadDocument(async () => undefined);
    f.objects.A.color = '#ff0000';
    f.objects.l.label = true;
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, pointColor: '#059669', pointSize: 8, lineThickness: 7 });
    expect(f.objects.A).toMatchObject({ color: '#ff0000', size: 8 });
    expect(f.objects.B.color).toBe('#059669');
    expect(f.objects.l).toMatchObject({ label: true, size: 7 });
    f.controller.dispose();
  });

  it('keeps customized draft styles after reload using the persisted ownership snapshot', async () => {
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    f.objects.A.color = '#ff0000';
    const snapshot = await f.controller.snapshot();
    f.controller.dispose();
    const restored = new PreferenceController(f.engine, { ...DEFAULT_GGB_PREFERENCES, pointColor: '#059669' }, f.errors);
    await restored.loadDocument(async () => undefined, snapshot);
    expect(f.objects.A.color).toBe('#ff0000');
    restored.dispose();
  });

  it('keeps the ownership baseline when a customized object is renamed', async () => {
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    f.objects.A.color = '#ff0000';
    f.objects.P = f.objects.A;
    delete f.objects.A;
    f.emit('rename', 'P', 'A');
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, pointColor: '#059669' });
    expect(f.objects.P.color).toBe('#ff0000');
    f.controller.dispose();
  });

  it('normalizes a new import with current preferences, then styles new objects', async () => {
    const f = fixture();
    await f.controller.loadDocument(async () => undefined);
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, pointSize: 9, lineLabels: true });
    await f.controller.loadDocument(async () => { f.emit('clear'); f.objects.A = point(); f.emit('add', 'A'); });
    expect(f.objects.A.size).toBe(9);
    f.objects.l = line(); f.emit('add', 'l');
    await f.controller.snapshot();
    expect(f.objects.l).toMatchObject({ label: true, size: 3 });
    f.controller.dispose();
  });

  it('reapplies after the native Open clear/add burst settles', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.controller.loadDocument(async () => undefined);
    f.emit('clear');
    f.objects.c = line('conic'); f.emit('add', 'c');
    await vi.advanceTimersByTimeAsync(200);
    await f.controller.snapshot();
    expect(f.objects.c.label).toBe(false);
    expect(f.callApi).toHaveBeenLastCalledWith('refreshViews', []);
    f.controller.dispose();
  });

  it('can explicitly replace individual edits and creates undo boundaries', async () => {
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    f.objects.A.color = '#ff0000';
    await f.controller.applyToAll();
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    expect(f.callApi.mock.calls.filter(([method]) => method === 'setUndoPoint')).toHaveLength(2);
    f.objects.A.size = 1;
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, stylePolicy: 'override' });
    expect(f.objects.A.size).toBe(DEFAULT_GGB_PREFERENCES.pointSize);
    f.controller.dispose();
  });

  it('changes just the requested view without resetting the document perspective', async () => {
    const f = fixture();
    await f.controller.loadDocument(async () => undefined);
    f.callApi.mockClear();
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, algebra: true, cas: true });
    expect(f.callApi).toHaveBeenCalledWith('setPerspective', ['+A']);
    expect(f.callApi).toHaveBeenCalledWith('setPerspective', ['+C']);
    expect(f.callApi).not.toHaveBeenCalledWith('setPerspective', ['ACG']);
    f.controller.dispose();
  });

  it('cancels native reload work when the engine is disposed', async () => {
    vi.useFakeTimers();
    const f = fixture();
    await f.controller.loadDocument(async () => undefined);
    f.emit('clear'); f.controller.dispose(); f.callApi.mockClear();
    await vi.advanceTimersByTimeAsync(250);
    expect(f.callApi).not.toHaveBeenCalled();
  });
});

it('validates stored preferences and migrates missing fields without trusting invalid input', () => {
  expect(normalizePreferences({ pointSize: 99, decimals: -3, lineThickness: NaN, axes: 'false', pointColor: 'red' })).toMatchObject({ pointSize: 9, decimals: 0, lineThickness: 3, axes: false, pointColor: '#2563eb' });
  expect(normalizePreferences(null)).toEqual(DEFAULT_GGB_PREFERENCES);
});
