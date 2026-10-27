import type { GeoGebraEngine } from '../types';
import { geometryTypeLabel } from '../geometryObjectTypes';
import type { ObjectStyle } from './types';

const normalize = (type: string) => type.replace(/^geo/i, '').replace(/[\s_-]/g, '').toLowerCase();
export const LINE_TYPES = /^(?:line|segment|ray|vector|polyline|polygon|conic|conicpart|circle|ellipse|hyperbola|parabola|intersectinglines|parallellines|doubleline|emptyset|function|functionnvar|curve|curvecartesian|implicitpoly|implicitcurve|locus|penstroke|turtle|angle|quadric|surface)(?:3d)?$/i;
const FILL_TYPES = /^(?:polygon|conic|conicpart|circle|ellipse|hyperbola|parabola|intersectinglines|parallellines|doubleline|emptyset|angle|image|quadric|surface|curvecartesian|inequality)(?:3d)?$/i;
export const STYLE_KEYS = ['label', 'size', 'color', 'opacity', 'strokeOpacity', 'lineStyle', 'pointStyle'] as const;
export const LINE_STYLES = [
  { value: 0, label: 'Solid', dash: '' },
  { value: 1, label: 'Long dash · sparse', dash: '10 6' },
  { value: 2, label: 'Short dash · dense', dash: '5 4' },
  { value: 3, label: 'Dotted', dash: '1 4' },
  { value: 4, label: 'Dash-dot', dash: '9 4 1 4' },
] as const;
export const POINT_STYLES = [
  { value: -1, label: 'Default', glyph: '•' }, { value: 0, label: 'Filled circle', glyph: '●' },
  { value: 1, label: 'Cross', glyph: '×' }, { value: 2, label: 'Circle', glyph: '○' },
  { value: 3, label: 'Plus', glyph: '+' }, { value: 4, label: 'Filled diamond', glyph: '◆' },
  { value: 5, label: 'Diamond', glyph: '◇' }, { value: 6, label: 'Triangle up', glyph: '▲' },
  { value: 7, label: 'Triangle down', glyph: '▼' }, { value: 8, label: 'Triangle right', glyph: '▶' },
  { value: 9, label: 'Triangle left', glyph: '◀' }, { value: 10, label: 'Circle without outline', glyph: '●' },
] as const;

export interface ObjectStyleInfo {
  type: string;
  typeLabel: string;
  point: boolean;
  line: boolean;
  fill: boolean;
  stroke: boolean;
  xml: string;
}
export interface SelectedObjectStyle extends ObjectStyleInfo, ObjectStyle { name: string }

export async function describeObjectStyle(engine: GeoGebraEngine, name: string): Promise<ObjectStyleInfo | null> {
  const [reported, source] = await Promise.all([
    engine.callApi('getObjectType', [name]), engine.callApi('getXML', [name]).catch(() => ''),
  ]);
  if (!reported) return null;
  const type = normalize(String(reported));
  const xml = typeof source === 'string' ? source : '';
  // A point-like conic still needs conic setters. XML retains the real class
  // even when getObjectType changes as the construction degenerates.
  const stored = normalize(xml.match(/<element\b[^>]*\btype="([^"]+)"/)?.[1] ?? type);
  const point = /^point(3d|onpath|inregion)?$/.test(stored);
  const line = !point && (LINE_TYPES.test(stored) || LINE_TYPES.test(type));
  return { type, typeLabel: stored.startsWith('conic') && type === 'point' ? 'Conic · single point' : geometryTypeLabel(type),
    point, line, fill: !point && FILL_TYPES.test(stored), stroke: line && /<lineStyle\b/.test(xml), xml };
}

export const strokeOpacityFromXml = (xml: string): number => {
  const tag = xml.match(/<lineStyle\b[^>]*>/)?.[0] ?? '';
  const opacity = tag.match(/\bopacity="([^"]+)"/)?.[1];
  return opacity === undefined ? 1 : Math.max(0, Math.min(1, Number(opacity) / 255));
};

/** Replace just the native style attribute, retaining every other XML field. */
export function withStrokeOpacity(xml: string, opacity: number): string {
  if (!/<element\b/.test(xml) || !/<lineStyle\b[^>]*\/>/.test(xml)) throw new Error('Stroke opacity is unavailable for this object.');
  return xml.replace(/<lineStyle\b[^>]*\/>/, (tag) => {
    const attribute = `opacity="${Math.round(opacity * 255)}"`;
    return /\bopacity="[^"]*"/.test(tag) ? tag.replace(/\bopacity="[^"]*"/, attribute) : tag.replace(/\s*\/>$/, ` ${attribute}/>`);
  });
}

export async function readObjectStyleValues(engine: GeoGebraEngine, name: string, info: ObjectStyleInfo, xml?: string): Promise<ObjectStyle> {
  const methods: Partial<Record<keyof ObjectStyle, string>> = { color: 'getColor', label: 'getLabelVisible' };
  if (info.point || info.line) methods.size = info.point ? 'getPointSize' : 'getLineThickness';
  if (info.point) methods.pointStyle = 'getPointStyle';
  if (info.line) methods.lineStyle = 'getLineStyle';
  if (info.fill) methods.opacity = 'getFilling';
  const values: ObjectStyle = {};
  const reads = Object.entries(methods).map(async ([key, method]) => {
    try {
      const value = await engine.callApi(method, [name]);
      if (key === 'label' && typeof value === 'boolean' || key === 'color' && typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
        || !['label', 'color'].includes(key) && typeof value === 'number' && Number.isFinite(value)) values[key as keyof ObjectStyle] = value as never;
    } catch { /* Missing optional getters must not disable the whole selection. */ }
  });
  if (info.stroke) reads.push((async () => {
    const current = xml ?? await engine.callApi('getXML', [name]).catch(() => undefined);
    if (typeof current === 'string') values.strokeOpacity = strokeOpacityFromXml(current);
  })());
  await Promise.all(reads);
  return values;
}

export async function writeObjectStyle(engine: GeoGebraEngine, name: string, key: keyof ObjectStyle, value: string | number | boolean, info: ObjectStyleInfo) {
  if (key === 'strokeOpacity') {
    if (!info.stroke) return;
    const xml = withStrokeOpacity(String(await engine.callApi('getXML', [name])), Number(value));
    if (engine.updateStyleXml) await engine.updateStyleXml(name, xml);
    else await engine.callApi('evalXML', [xml]);
    return;
  }
  const method = key === 'color' ? 'setColor' : key === 'label' ? 'setLabelVisible'
    : key === 'opacity' ? info.fill && 'setFilling' : key === 'lineStyle' ? info.line && 'setLineStyle'
      : key === 'pointStyle' ? info.point && 'setPointStyle' : (info.point || info.line) && (info.point ? 'setPointSize' : 'setLineThickness');
  if (!method) return;
  const args = key === 'color' ? [name, ...[1, 3, 5].map((start) => parseInt(String(value).slice(start, start + 2), 16))] : [name, value];
  await engine.callApi(method, args);
}

export function validateObjectStyle(patch: ObjectStyle) {
  if (patch.color !== undefined && !/^#[\da-f]{6}$/i.test(patch.color)) throw new Error('Use a six-digit hex color.');
  for (const key of ['opacity', 'strokeOpacity'] as const) if (patch[key] !== undefined && (!Number.isFinite(patch[key]) || patch[key]! < 0 || patch[key]! > 1)) throw new Error('Opacity must be between 0 and 100%.');
  if (patch.lineStyle !== undefined && !LINE_STYLES.some(({ value }) => value === patch.lineStyle)) throw new Error('Unsupported line style.');
  if (patch.pointStyle !== undefined && !POINT_STYLES.some(({ value }) => value === patch.pointStyle)) throw new Error('Unsupported point style.');
}

export async function readObjectStyles(engine: GeoGebraEngine, names: readonly string[]): Promise<SelectedObjectStyle[]> {
  const result: SelectedObjectStyle[] = [];
  for (const name of names) {
    const info = await describeObjectStyle(engine, name);
    if (!info) continue;
    const values = await readObjectStyleValues(engine, name, info, info.xml);
    if (values.color !== undefined) result.push({ name, ...info, ...values, color: values.color.toLowerCase() });
  }
  return result;
}
