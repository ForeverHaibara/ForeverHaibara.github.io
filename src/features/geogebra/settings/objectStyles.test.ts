import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../types';
import { describeObjectStyle, readObjectStyles, strokeOpacityFromXml, validateObjectStyle, withStrokeOpacity, writeObjectStyle } from './objectStyles';

function engineFor(type: string, storedType = type) {
  let xml = `<element type="${storedType}" label="c"><lineStyle thickness="7" type="15" typeHidden="1"/><objColor r="12" g="34" b="56" alpha="0.25"/><coords x="1" y="2" z="1"/></element>`;
  const callApi = vi.fn(async (method: string, args: unknown[]) => {
    if (method === 'getObjectType') return type;
    if (method === 'getXML') return xml;
    if (method === 'getColor') return '#ABCDEF';
    if (method === 'getLabelVisible') return true;
    if (method === 'getPointSize' || method === 'getLineThickness') return 7;
    if (method === 'getPointStyle') return 5;
    if (method === 'getLineStyle') return 1;
    if (method === 'getFilling') return 0.25;
    if (method === 'evalXML') xml = String(args[0]);
  });
  return { engine: { callApi } as unknown as GeoGebraEngine, callApi, getXml: () => xml };
}

describe('native object style capabilities', () => {
  it.each(['intersectinglines', 'parallellines', 'doubleline', 'emptyset', 'line3d', 'ray3d', 'conicpart3d', 'curvecartesian3d'])('supports a %s without rejecting the palette selection', async (type) => {
    const f = engineFor(type);
    const [style] = await readObjectStyles(f.engine, ['c']);
    expect(style).toMatchObject({ name: 'c', type, point: false, line: true, color: '#abcdef', lineStyle: 1, strokeOpacity: 1 });
  });
  it('uses XML class to distinguish an actual point from a conic degenerated to a single point', async () => {
    const conic = engineFor('point', 'conic');
    const [style] = await readObjectStyles(conic.engine, ['c']);
    expect(style).toMatchObject({ typeLabel: 'Conic · single point', point: false, line: true, opacity: .25 });
    expect(style.pointStyle).toBeUndefined();
    expect(conic.callApi).not.toHaveBeenCalledWith('getPointSize', ['c']);
    const point = engineFor('point');
    expect((await readObjectStyles(point.engine, ['c']))[0]).toMatchObject({ point: true, pointStyle: 5 });
  });
  it('allows general object colors and image opacity without applying line-only controls', async () => {
    const image = engineFor('image');
    expect((await readObjectStyles(image.engine, ['c']))[0]).toMatchObject({ point: false, line: false, opacity: .25 });
    expect((await readObjectStyles(engineFor('text').engine, ['c']))[0].opacity).toBeUndefined();
  });
  it('changes stroke opacity in place while retaining every unrelated native XML field', async () => {
    const f = engineFor('segment'); const before = f.getXml();
    const info = (await describeObjectStyle(f.engine, 'c'))!;
    await writeObjectStyle(f.engine, 'c', 'strokeOpacity', .4, info);
    expect(f.getXml()).toBe(before.replace('typeHidden="1"/>', 'typeHidden="1" opacity="102"/>'));
    expect(strokeOpacityFromXml(f.getXml())).toBe(.4);
    expect(withStrokeOpacity(f.getXml(), 0)).toContain('opacity="0"');
    expect(withStrokeOpacity(f.getXml(), 1)).toContain('opacity="255"');
    expect(f.callApi).not.toHaveBeenCalledWith('setXML', expect.anything());
  });
  it('does not let a missing optional getter disable valid color and thickness controls', async () => {
    const f = engineFor('segment');
    const original = f.callApi.getMockImplementation()!;
    f.callApi.mockImplementation(async (method, args) => { if (method === 'getLineStyle') throw new Error('Unsupported'); return original(method, args); });
    const [style] = await readObjectStyles(f.engine, ['c']);
    expect(style.color).toBe('#abcdef'); expect(style.size).toBe(7); expect(style.lineStyle).toBeUndefined();
  });
  it('rejects invalid style values before mutating the native construction', () => {
    expect(() => validateObjectStyle({ opacity: NaN })).toThrow();
    expect(() => validateObjectStyle({ strokeOpacity: 2 })).toThrow();
    expect(() => validateObjectStyle({ lineStyle: 15 })).toThrow();
    expect(() => validateObjectStyle({ pointStyle: 11 })).toThrow();
    expect(() => validateObjectStyle({ pointStyle: 10, lineStyle: 4, opacity: 0 })).not.toThrow();
  });
});
