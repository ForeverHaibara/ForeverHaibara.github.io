import type { GeoGebraEngine } from '../types';
import type { ObjectStyle } from './types';

export const LINE_TYPES = /^(line|segment|ray|vector|polyline|polygon|conic|conicpart|circle|ellipse|hyperbola|parabola|function|functionnvar|curve|curvecartesian|implicitpoly|implicitcurve|locus|penstroke|turtle)$/i;

export interface SelectedObjectStyle extends Required<ObjectStyle> { name: string; point: boolean }

export async function readObjectStyles(engine: GeoGebraEngine, names: readonly string[]): Promise<SelectedObjectStyle[]> {
  const result: SelectedObjectStyle[] = [];
  for (const name of names) {
    const type = String(await engine.callApi('getObjectType', [name]));
    const point = /^point/i.test(type);
    if (!point && !LINE_TYPES.test(type)) continue;
    const [color, size, label] = await Promise.all([
      engine.callApi('getColor', [name]),
      engine.callApi(point ? 'getPointSize' : 'getLineThickness', [name]),
      engine.callApi('getLabelVisible', [name]),
    ]);
    result.push({ name, point, color: String(color).toLowerCase(), size: Number(size), label: Boolean(label) });
  }
  return result;
}
