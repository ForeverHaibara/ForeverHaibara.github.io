import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenceController } from './PreferenceController';
import { DEFAULT_GGB_PREFERENCES } from './defaults';
import { normalizePreferences } from './preferenceStore';
import type { EngineEventListener, GeoGebraEngine, GeometryEvent } from '../types';

type ObjectState = { type: string; label: boolean; size: number; color: string; role?: 'free' | 'constrained' | 'dependent'; opacity?: number; lineStyle?: number; pointStyle?: number; strokeOpacity?: number; storedType?: string };
function fixture(objects: Record<string, ObjectState> = {}) {
  const listeners = new Set<EngineEventListener>();
  const callApi = vi.fn(async (method: string, args: unknown[]) => {
    const [name, value] = args;
    const object = objects[String(name)];
    if (method === 'getAllObjectNames') return Object.keys(objects);
    if (method === 'getObjectType') return object?.type ?? '';
    if (method === 'getXML' && object && object.strokeOpacity !== undefined) return `<element type="${object.storedType ?? object.type}" label="${name}"><lineStyle thickness="${object.size}" type="0" opacity="${Math.round(object.strokeOpacity * 255)}"/></element>`;
    if (method === 'evalXML') {
      const source = String(name); const target = objects[source.match(/label="([^"]+)"/)![1]];
      target.strokeOpacity = Number(source.match(/opacity="([^"]+)"/)![1]) / 255;
    }
    if (method === 'getFilling') return object.opacity;
    if (method === 'getLineStyle') return object.lineStyle;
    if (method === 'getPointStyle') return object.pointStyle;
    if (method === 'setFilling') object.opacity = Number(value);
    if (method === 'setLineStyle') object.lineStyle = Number(value);
    if (method === 'setPointStyle') object.pointStyle = Number(value);
    if (method === 'isIndependent') return !object.role || object.role === 'free';
    if (method === 'getAlgorithmXML') return `<command name="${object.role === 'constrained' ? 'Point' : 'Intersect'}"><input a0="g"/><output a0="${name}"/></command>`;
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
  it('keeps fill, stroke, point and line styles through reconstruction, draft reload and selected reset', async () => {
    vi.useFakeTimers();
    const f = fixture({ A: { ...point(), pointStyle: 0 }, c: { ...line('intersectinglines'), storedType: 'conic', opacity: 0, lineStyle: 0, strokeOpacity: 1 } });
    await f.controller.loadDocument(async () => undefined);
    await f.controller.editObjects(['A'], { pointStyle: 5 });
    await f.controller.editObjects(['c'], { color: '#ff0000', opacity: .35, strokeOpacity: .4, lineStyle: 2 });
    const saved = await f.controller.snapshot();
    expect(f.objects.c).toMatchObject({ opacity: .35, strokeOpacity: .4, lineStyle: 2 });
    f.emit('clear');
    f.objects.A.pointStyle = 0;
    Object.assign(f.objects.c, { color: '#000000', opacity: 0, strokeOpacity: 1, lineStyle: 0 });
    f.emit('add', 'A'); f.emit('add', 'c');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.A.pointStyle).toBe(5);
    expect(f.objects.c).toMatchObject({ color: '#ff0000', opacity: .35, strokeOpacity: .4, lineStyle: 2 });
    f.controller.dispose();
    const restored = new PreferenceController(f.engine, { ...DEFAULT_GGB_PREFERENCES }, f.errors);
    f.objects.c.opacity = 0;
    await restored.loadDocument(async () => undefined, saved);
    expect(f.objects.c.opacity).toBe(.35);
    await restored.editObjects(['A', 'c'], null);
    expect(f.objects.A.pointStyle).toBe(0);
    expect(f.objects.c).toMatchObject({ opacity: 0, strokeOpacity: 1, lineStyle: 0 });
    expect(f.errors).not.toHaveBeenCalled();
    restored.dispose();
  });

  it('records native advanced-style edits and does not assign line defaults to general objects', async () => {
    vi.useFakeTimers();
    const f = fixture({ pic: { ...line('image'), opacity: .8 }, c: { ...line('parallellines'), opacity: 0, lineStyle: 0, strokeOpacity: 1 } });
    await f.controller.loadDocument(async () => undefined);
    expect(f.objects.pic.color).toBe('#000000');
    f.objects.pic.opacity = .3; f.emit('style', 'pic');
    f.objects.c.lineStyle = 4; f.emit('style', 'c');
    f.emit('clear'); f.objects.pic.opacity = 1; f.objects.c.lineStyle = 0;
    f.emit('add', 'pic'); f.emit('add', 'c');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.pic.opacity).toBe(.3); expect(f.objects.c.lineStyle).toBe(4);
    expect(f.errors).not.toHaveBeenCalled();
    f.controller.dispose();
  });
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

  it('colors points by construction role and preserves a manually customized dependent point', async () => {
    const f = fixture({ A: point(), T: { ...point(), role: 'constrained' }, I: { ...point(), role: 'dependent' }, M: { ...point(), role: 'dependent' } });
    await f.controller.loadDocument(async () => undefined);
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    expect(f.objects.T.color).toBe(DEFAULT_GGB_PREFERENCES.constrainedPointColor);
    expect(f.objects.I.color).toBe(DEFAULT_GGB_PREFERENCES.dependentPointColor);
    f.objects.I.color = '#ff0000';
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, constrainedPointColor: '#00ffff', dependentPointColor: '#111111' });
    expect(f.objects.T.color).toBe('#00ffff');
    expect(f.objects.M.color).toBe('#111111');
    expect(f.objects.I.color).toBe('#ff0000');
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, pointColorMode: 'uniform' });
    expect(f.objects.T.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    expect(f.objects.M.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    expect(f.objects.I.color).toBe('#ff0000');
    f.controller.dispose();
  });

  it('upgrades a legacy single-color draft without replacing individual overrides', async () => {
    const oldColor = DEFAULT_GGB_PREFERENCES.pointColor;
    const f = fixture({ I: { ...point(), role: 'dependent', color: oldColor }, J: { ...point(), role: 'dependent', color: '#ff0000' }, T: { ...point(), role: 'constrained', color: oldColor } });
    await f.controller.loadDocument(async () => undefined, { I: { color: oldColor }, J: { color: oldColor }, T: { color: oldColor } });
    expect(f.objects.I.color).toBe(DEFAULT_GGB_PREFERENCES.dependentPointColor);
    expect(f.objects.T.color).toBe(DEFAULT_GGB_PREFERENCES.constrainedPointColor);
    expect(f.objects.J.color).toBe('#ff0000');
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
    expect(f.callApi).toHaveBeenCalledWith('refreshViews', []);
    f.controller.dispose();
  });

  it('preserves native manual edits across attach/detach clear and remove/add reconstruction', async () => {
    vi.useFakeTimers();
    const f = fixture({ A: point(), B: point(), l: line() });
    await f.controller.loadDocument(async () => undefined);
    f.objects.A.color = '#ff0000'; f.objects.l.size = 8;
    f.emit('style', 'A'); f.emit('style', 'l');
    // Simulate a rebuild which resets native styles, including a role change.
    f.emit('clear');
    f.objects.A = { ...point(), role: 'constrained' }; f.emit('add', 'A');
    f.objects.B = { ...point(), role: 'constrained' }; f.emit('add', 'B');
    f.objects.l = line(); f.emit('add', 'l');
    await vi.advanceTimersByTimeAsync(200);
    await f.controller.snapshot();
    expect(f.objects.A.color).toBe('#ff0000');
    expect(f.objects.B.color).toBe(DEFAULT_GGB_PREFERENCES.constrainedPointColor);
    expect(f.objects.l.size).toBe(8);
    f.emit('remove', 'A'); f.objects.A = point(); f.emit('add', 'A');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.A.color).toBe('#ff0000');
    f.controller.dispose();
  });

  it('does not interpret background reloads as explicit overrides, even with prefer-defaults enabled', async () => {
    vi.useFakeTimers();
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, stylePolicy: 'override' });
    await f.controller.editObjects(['A'], { color: '#ff0000', size: 7 });
    f.emit('clear'); f.objects.A = point(); f.emit('add', 'A');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.A).toMatchObject({ color: '#ff0000', size: 7 });
    // A deliberate preference change still opts into the selected policy.
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, stylePolicy: 'override', pointSize: 8 });
    expect(f.objects.A).toMatchObject({ color: DEFAULT_GGB_PREFERENCES.pointColor, size: 8 });
    f.controller.dispose();
  });

  it('retains intentional same-color overrides, supports selected reset, rename, and draft restoration', async () => {
    const f = fixture({ A: point(), B: point() });
    await f.controller.loadDocument(async () => undefined);
    await f.controller.editObjects(['A', 'B'], { color: DEFAULT_GGB_PREFERENCES.pointColor, size: 7, label: false });
    await f.controller.update({ ...DEFAULT_GGB_PREFERENCES, pointColor: '#059669' });
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    await f.controller.editObjects(['B'], null);
    expect(f.objects.B).toMatchObject({ color: '#059669', size: 5, label: true });
    f.objects.P = f.objects.A; delete f.objects.A; f.emit('rename', 'P', 'A');
    const saved = await f.controller.snapshot();
    f.controller.dispose();
    const restored = new PreferenceController(f.engine, { ...DEFAULT_GGB_PREFERENCES }, f.errors);
    f.objects.P = point();
    await restored.loadDocument(async () => undefined, saved);
    expect(f.objects.P).toMatchObject({ color: DEFAULT_GGB_PREFERENCES.pointColor, size: 7, label: false });
    restored.dispose();
  });

  it('accepts undo and redo styles instead of replaying stale overrides during reconstruction', async () => {
    vi.useFakeTimers();
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    await f.controller.editObjects(['A'], { color: '#ff0000' });
    f.emit('clear'); f.objects.A.color = DEFAULT_GGB_PREFERENCES.pointColor; f.emit('add', 'A'); f.emit('undo');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    f.emit('clear'); f.objects.A.color = '#ff0000'; f.emit('add', 'A'); f.emit('redo');
    await vi.advanceTimersByTimeAsync(200);
    expect(f.objects.A.color).toBe('#ff0000');
    f.controller.dispose();
  });

  it('prunes deleted objects and resets ownership at an explicit document boundary', async () => {
    vi.useFakeTimers();
    const f = fixture({ A: point() });
    await f.controller.loadDocument(async () => undefined);
    await f.controller.editObjects(['A'], { color: '#ff0000' });
    delete f.objects.A; f.emit('remove', 'A');
    await vi.advanceTimersByTimeAsync(200);
    f.objects.A = point(); f.emit('add', 'A'); await f.controller.snapshot();
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
    await f.controller.editObjects(['A'], { color: '#ff0000' });
    await f.controller.loadDocument(async () => { f.emit('clear'); f.objects.A = point(); f.emit('add', 'A'); });
    expect(f.objects.A.color).toBe(DEFAULT_GGB_PREFERENCES.pointColor);
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
  expect(normalizePreferences({ palette: 'ink', pointColor: '#18181b' })).toMatchObject({ pointColorMode: 'uniform', constrainedPointColor: '#18181b', dependentPointColor: '#18181b' });
  expect(normalizePreferences({ palette: 'violet', pointColor: '#7c3aed' })).toMatchObject({ pointColorMode: 'by-role', constrainedPointColor: '#db2777', dependentPointColor: '#475569' });
  expect(normalizePreferences({ pointColor: '#ffaa33', constrainedPointColor: 'red', dependentPointColor: '#ABCDEF' })).toMatchObject({ pointColor: '#ffaa33', constrainedPointColor: DEFAULT_GGB_PREFERENCES.constrainedPointColor, dependentPointColor: '#abcdef' });
});
