import { GEOGEBRA_COMMAND_NAMES } from '../completion/geogebraCommandNames';
import { outerCalls, splitTopLevel } from './commandSyntax';
import { expandTool, selectOverload, studioTools, toolSignature } from './toolLibrary';
import type { CommandEnvironment, GeometryType, TypedExpression } from './types';

const nativeNames = new Set(GEOGEBRA_COMMAND_NAMES.map((name) => name.toLowerCase()));
const nativeReturns: Record<string, GeometryType> = {
  point: 'point', midpoint: 'point', trianglecenter: 'point', intersect: 'point',
  closestpoint: 'point', center: 'point', barycenter: 'point', focus: 'point',
  line: 'line', perpendicularline: 'line', parallel: 'line', polar: 'line',
  segment: 'segment', ray: 'ray', circle: 'circle', incircle: 'circle',
  ellipse: 'conic', hyperbola: 'conic', parabola: 'conic', conic: 'conic',
  distance: 'number', length: 'number', angle: 'number', x: 'number', y: 'number', z: 'number',
  abs: 'number', sqrt: 'number', sin: 'number', cos: 'number',
  sequence: 'list', zip: 'list', join: 'list', solutions: 'list',
};

const stripParens = (value: string): string => {
  let result = value.trim();
  while (result.startsWith('(') && result.endsWith(')')) {
    try { if (splitTopLevel(result.slice(1, -1)).length !== 1) break; }
    catch { break; }
    result = result.slice(1, -1).trim();
  }
  return result;
};

/** Recognize only unambiguous types; never create probe objects or sample numeric values. */
const literalType = (expression: string, environment: CommandEnvironment): GeometryType => {
  const source = expression.trim();
  const known = environment.objects.get(source);
  if (known) return known;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(source)) return 'number';
  if (source.startsWith('{') && source.endsWith('}')) return 'list';
  if (source.startsWith('(') && source.endsWith(')')) {
    try { if (splitTopLevel(source.slice(1, -1)).length === 2) return 'point'; }
    catch { /* Separate parenthesized operands, e.g. (A)+(B), are not a tuple. */ }
  }
  const stripped = stripParens(source);
  if (stripped !== source) return literalType(stripped, environment);
  if (/^[+-]/u.test(source)) return literalType(source.slice(1), environment);
  for (const operators of ['+-', '*/', '^']) {
    const parts = splitTopLevel(source, operators);
    if (parts.length < 2) continue;
    const types = parts.filter((part) => part.trim()).map((part) => literalType(part, environment));
    if (types.every((type) => type === 'number')) return 'number';
    if (operators === '+-' && types.every((type) => type === 'point')) return 'point';
    if (operators === '*/' && types[0] === 'point' && types.slice(1).every((type) => type === 'number')) return 'point';
    if (operators === '*/' && types.at(-1) === 'point' && types.slice(0, -1).every((type) => type === 'number') && !source.includes('/')) return 'point';
    return 'unknown';
  }
  return 'unknown';
};

export const containsStudioCall = (source: string, depth = 0): boolean => {
  if (depth > 64) throw new Error('Custom command nesting exceeds 64 levels.');
  return outerCalls(source).some((call) => !call.declaration && (studioTools.has(call.name.toLowerCase()) || call.args.some((arg) => containsStudioCall(arg, depth + 1))));
};

export const compileStudioCommand = (source: string, environment: CommandEnvironment): string => {
  const occupied = new Set([...source.matchAll(/[\p{L}_][\p{L}\p{N}_']*/gu)].map((match) => match[0]));
  for (const name of environment.objects.keys()) occupied.add(name);
  let serial = 0;
  // Zip/KeepIf require identifiers: bare _ and # are not accepted by GeoGebra.
  // Short ASCII names stay readable while avoiding every source/global label.
  const allocate = () => { let name: string; do { name = `v${++serial}`; } while (occupied.has(name)); occupied.add(name); return name; };

  const compile = (input: string, scope = environment, depth = 0): TypedExpression => {
    if (depth > 64) throw new Error('Custom command nesting exceeds 64 levels.');
    const calls = outerCalls(input);
    let cursor = 0;
    let expression = '';
    let typeSource = '';
    const typeScope: CommandEnvironment = { ...scope, objects: new Map(scope.objects) };
    let entireType: GeometryType = literalType(input, scope);
    for (const call of calls) {
      expression += input.slice(cursor, call.start);
      typeSource += input.slice(cursor, call.start);
      const key = call.name.toLowerCase();
      // Declarations and file-defined callables keep native evaluation semantics.
      if (call.declaration) {
        expression += input.slice(call.start, call.end);
        typeSource += input.slice(call.start, call.end);
        cursor = call.end;
        continue;
      }
      const localScope: CommandEnvironment = { ...scope, objects: new Map(scope.objects) };
      const listElementType = (list: string): GeometryType => {
        const text = list.trim();
        if (text.startsWith('{') && text.endsWith('}')) return compile(splitTopLevel(text.slice(1, -1))[0], scope, depth + 1).type;
        return 'unknown';
      };
      if (key === 'zip') {
        for (let i = 1; i + 1 < call.args.length; i += 2) localScope.objects.set(call.args[i].trim(), listElementType(call.args[i + 1]));
      } else if (['sequence', 'curve', 'sum', 'product'].includes(key) && call.args.length >= 4) {
        localScope.objects.set(call.args[key === 'curve' ? call.args.length - 3 : 1].trim(), 'number');
      } else if (key === 'keepif' && call.args.length === 3) localScope.objects.set(call.args[1].trim(), listElementType(call.args[2]));
      const args = call.args.map((arg, index) => compile(arg, index === 0 || key === 'curve' && index < call.args.length - 3 ? localScope : scope, depth + 1));
      const native = `${input.slice(call.start, call.open + 1)}${args.map((arg) => arg.expression).join(',')}${input[call.end - 1]}`;
      let result: TypedExpression = { expression: native, type: nativeReturns[key] ?? 'unknown' };
      const fileDefined = scope.macros.has(key) || scope.objects.has(call.name);
      if (fileDefined) result.type = scope.macroTypes?.get(key) ?? (scope.objects.get(call.name) === 'function' ? 'number' : 'unknown');
      const tool = studioTools.get(key);
      if (tool && !fileDefined) {
        const overload = selectOverload(tool, args);
        if (overload) result = expandTool(overload, args, allocate);
        else if (!nativeNames.has(key)) throw new Error(`No overload for ${tool.name}(${args.map((arg) => arg.type).join(', ')}). Expected: ${tool.overloads.map((overload) => toolSignature(tool, overload)).join(' or ')}. Use existing object labels or typed nested commands for unknown arguments.`);
      }
      if (['reflect', 'rotate', 'translate', 'dilate', 'applymatrix'].includes(key) && !fileDefined) result.type = args[key === 'applymatrix' ? 1 : 0]?.type ?? 'unknown';
      if (key === 'if' && (args.length === 2 || args[1]?.type === args[2]?.type)) result.type = args[1].type;
      if (key === 'element' && call.args.length >= 2) result.type = listElementType(call.args[0]);
      if (result.outputCount) {
        const prefix = input.slice(0, call.start).trim();
        const suffix = input.slice(call.end).replace(/(?:\/\/|#)[^\n]*/gu, '').trim();
        const standalone = depth === 0 && !suffix && (!prefix || /^[\p{L}_][\p{L}\p{N}_{}']*\s*=$/u.test(prefix));
        const select = (index: number) => `Element(${result.expression},${index + (result.outputOffset ?? 0)})`;
        // GeoGebra supplies unused labels for subsequent outputs. An explicit
        // assignment labels the first object only.
        result.expression = standalone ? Array.from({ length: result.outputCount }, (_, i) => select(i + 1)).join('\n') : select(1);
        result.outputCount = undefined;
        result.outputOffset = undefined;
      }
      if (stripParens(input) === input.slice(call.start, call.end)) entireType = result.type;
      expression += result.expression;
      const typeName = allocate();
      typeScope.objects.set(typeName, result.type);
      typeSource += typeName;
      cursor = call.end;
    }
    expression += input.slice(cursor);
    typeSource += input.slice(cursor);
    if (entireType === 'unknown') entireType = literalType(typeSource, typeScope);
    if (expression.length > 500_000) throw new Error('Expanded command exceeds 500,000 characters.');
    return { expression, type: entireType };
  };

  return compile(source).expression;
};
