import type { GeoGebraEngine } from '../../types';
import type { CommandEnvironment, GeometryType } from './types';
import { isInternalHelperName } from './internalHelpers';

export const normalizeGeometryType = (type: unknown): GeometryType => {
  const value = String(type ?? '').toLowerCase().replace(/^geo/u, '');
  if (['point', 'pointonpath', 'pointinregion'].includes(value)) return 'point';
  if (['numeric', 'angle', 'number', 'integer'].includes(value)) return 'number';
  if (value === 'functionnvar' || value === 'multivariablefunction') return 'function';
  if (['implicitpoly', 'implicitcurve'].includes(value)) return 'implicitCurve';
  // GeoConic's API type string changes with its classification, even though
  // the underlying object and all of its dependencies remain a conic.
  if (['ellipse', 'hyperbola', 'parabola', 'conic', 'conicpart', 'intersectinglines', 'parallellines', 'doubleline', 'emptyset'].includes(value)) return 'conic';
  if (['line', 'segment', 'ray', 'circle', 'list', 'vector', 'function'].includes(value)) return value as GeometryType;
  return 'unknown';
};

interface FileTool {
  name: string;
  signature: string;
  returns: GeometryType;
}

const toolCaches = new WeakMap<GeoGebraEngine, { promise?: Promise<FileTool[]> }>();

const inspectFileTools = async (engine: GeoGebraEngine): Promise<FileTool[]> => {
  const file = await engine.callApi('getFileJSON', []);
  const archive = (typeof file === 'string' ? JSON.parse(file) : file) as { archive?: Array<{ fileName?: string; fileContent?: string }> } | null;
  if (!archive || !Array.isArray(archive.archive)) throw new Error('Unable to inspect file-defined tools; custom commands were not expanded to avoid overriding user tools.');
  const tools: FileTool[] = [];
  const xml = archive.archive.find((entry) => entry.fileName === 'geogebra_macro.xml')?.fileContent;
  if (xml) {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('Unable to read the file-defined tool names.');
    for (const macro of document.querySelectorAll('macro')) {
      const name = macro.getAttribute('cmdName');
      if (!name) continue;
      const types = new Map([...macro.querySelectorAll('element')].map((element) => [element.getAttribute('label'), normalizeGeometryType(element.getAttribute('type'))]));
      const inputs = macro.querySelector('macroInput');
      const params = inputs ? [...inputs.attributes].filter((attr) => /^a\d+$/u.test(attr.name)).sort((a, b) => Number(a.name.slice(1)) - Number(b.name.slice(1))).map((attr) => `${attr.value}: ${types.get(attr.value) ?? 'unknown'}`) : [];
      const outputs = macro.querySelector('macroOutput');
      const multiple = outputs?.hasAttribute('a1');
      tools.push({ name, signature: `${name}(${params.join(', ')})`, returns: multiple ? 'list' : types.get(outputs?.getAttribute('a0') ?? '') ?? 'unknown' });
    }
  }
  return tools;
};

/** File/tool events invalidate metadata, avoiding construction serialization on every command/keystroke. */
export const readFileTools = (engine: GeoGebraEngine, refresh = false): Promise<FileTool[]> => {
  let cache = toolCaches.get(engine);
  if (!cache) {
    cache = {};
    toolCaches.set(engine, cache);
    const entry = cache;
    engine.subscribe?.((event) => { if (event.type === 'clear' || event.type === 'toolsChanged') entry.promise = undefined; });
  }
  if (refresh || !cache.promise) {
    const entry = cache;
    const promise = inspectFileTools(engine);
    cache.promise = promise;
    void promise.catch(() => { if (entry.promise === promise) entry.promise = undefined; });
  }
  return cache.promise;
};

/** Read-only archive inspection: macros never need to be installed or rewritten. */
export const readCommandEnvironment = async (engine: GeoGebraEngine): Promise<CommandEnvironment> => {
  const raw = await engine.callApi('getAllObjectNames', []);
  const names: string[] = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').filter(Boolean) : [])
    .filter((name): name is string => typeof name === 'string' && !isInternalHelperName(name));
  const [pairs, tools] = await Promise.all([
    Promise.all(names.map(async (name): Promise<[string, GeometryType]> => {
      const type = normalizeGeometryType(await engine.callApi('getObjectType', [name]));
      // A GeoConic may report "line" or "point" after degenerating. Its XML
      // element class remains conic; preserve that class for typed dispatch.
      if (type === 'line' || type === 'point') {
        const xml = String(await engine.callApi('getXML', [name]));
        if (/<element\b[^>]*\btype=["']conic["']/u.test(xml)) return [name, 'conic'];
      }
      return [name, type];
    })),
    readFileTools(engine),
  ]);
  return { objects: new Map(pairs), macros: new Set(tools.map((tool) => tool.name.toLowerCase())), macroTypes: new Map(tools.map((tool) => [tool.name.toLowerCase(), tool.returns])) };
};
