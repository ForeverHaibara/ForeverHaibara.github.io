import { GEOGEBRA_COMMAND_NAMES } from '../completion/geogebraCommandNames';
import { outerCalls, splitTopLevel } from './commandSyntax';
import { createBindingCapture, type CompiledBindingPlan } from './bindingPlan';
import { expandTool, selectOverload, studioTools, toolSignature } from './toolLibrary';
import type { CommandEnvironment, GeometryType, ToolDefinition, ToolOverload, TypedExpression } from './types';
import type { BindingAllocator } from './algebra/homogeneous';

const nativeNames = new Set(GEOGEBRA_COMMAND_NAMES.map((name) => name.toLowerCase()));
const nativeReturns: Record<string, GeometryType> = {
  point: 'point', midpoint: 'point', trianglecenter: 'point', intersect: 'point', centroid: 'point',
  closestpoint: 'point', center: 'point', barycenter: 'point', focus: 'point', trilinear: 'point', tocomplex: 'point', topoint: 'point',
  line: 'line', perpendicularline: 'line', parallel: 'line', polar: 'line',
  segment: 'segment', ray: 'ray', vector: 'vector', circle: 'circle', incircle: 'circle',
  ellipse: 'conic', hyperbola: 'conic', parabola: 'conic', conic: 'conic',
  implicitcurve: 'implicitCurve', cubic: 'implicitCurve', trianglecurve: 'implicitCurve',
  leftside: 'function', rightside: 'function', derivative: 'function',
  distance: 'number', length: 'number', angle: 'number', x: 'number', y: 'number', z: 'number',
  abs: 'number', sqrt: 'number', sin: 'number', cos: 'number', radius: 'number', affineratio: 'number',
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

type Capture = ReturnType<typeof createBindingCapture> & { selected: Array<{ builder?: string; args: GeometryType[] }> };

export const compileStudioCommand = (source: string, environment: CommandEnvironment,
  tools: ReadonlyMap<string, ToolDefinition> = studioTools, capture?: Capture): string => {
  const occupied = new Set([...source.matchAll(/[\p{L}_][\p{L}\p{N}_']*/gu)].map((match) => match[0]));
  for (const name of environment.objects.keys()) occupied.add(name);
  for (const tool of tools.values()) for (const overload of tool.overloads) {
    for (const expression of [overload.compose ?? []].flat().concat((overload.locals ?? []).map((local) => local.expression))) {
      for (const match of expression.matchAll(/[\p{L}_][\p{L}\p{N}_']*/gu)) occupied.add(match[0]);
    }
  }
  const dependencies: Array<{ overload: ToolOverload; signature: string }> = [];
  let serial = 0;
  // Zip/KeepIf require identifiers: bare _ and # are not accepted by GeoGebra.
  // Short ASCII names stay readable while avoiding every source/global label.
  const allocate: BindingAllocator = () => { let name: string; do { name = `v${++serial}`; } while (occupied.has(name)); occupied.add(name); return name; };
  if (capture) allocate.captureBinding = capture.captureBinding;

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
      const tool = tools.get(key);
      if (tool && !fileDefined) {
        const overload = selectOverload(tool, args);
        if (overload) {
          if (depth === 0) capture?.selected.push({ builder: overload.builder, args: args.map((arg) => arg.type) });
          const signature = toolSignature(tool, overload);
          if (dependencies.some((dependency) => dependency.overload === overload)) throw new Error(`Cyclic tool composition: ${[...dependencies.map((dependency) => dependency.signature), signature].join(' -> ')}`);
          dependencies.push({ overload, signature });
          try {
            result = expandTool(overload, args, allocate, (template, bindings) => {
              // Compile only the definition, with typed opaque argument tokens.
              // File macros cannot change a library dependency; caller expressions
              // are substituted afterwards, so native calls are not expanded twice.
              const definitionScope: CommandEnvironment = { objects: new Map(), macros: new Set() };
              const replacements = new Map<string, string>();
              const tokens = new Map([...bindings].map(([name, binding]) => {
                const token = allocate();
                definitionScope.objects.set(token, binding.type);
                replacements.set(token, binding.expression);
                return [name, token];
              }));
              const body = template.replace(/\$([\p{L}_][\p{L}\p{N}_]*)/gu, (_, name: string) => tokens.get(name)!);
              const compiled = compile(body, definitionScope, depth + 1);
              compiled.expression = compiled.expression.replace(/"(?:\\.|[^"\\])*"|(?:\/\/|#)[^\n]*|[\p{L}_][\p{L}\p{N}_']*/gu,
                (token) => replacements.has(token) ? `(${replacements.get(token)})` : token);
              if (compiled.expression.length > 500_000) throw new Error('Expanded command exceeds 500,000 characters.');
              return compiled;
            });
          } finally { dependencies.pop(); }
        }
        else if (!nativeNames.has(key)) throw new Error(`No overload for ${tool.name}(${args.map((arg) => arg.type).join(', ')}). Expected: ${tool.overloads.map((overload) => toolSignature(tool, overload)).join(' or ')}. Use existing object labels or typed nested commands for unknown arguments.`);
      }
      if (key === 'polar' && !fileDefined && ['line', 'segment', 'ray'].includes(args[0]?.type)) result.type = 'point';
      if (['reflect', 'rotate', 'translate', 'dilate', 'applymatrix'].includes(key) && !fileDefined) result.type = args[key === 'applymatrix' ? 1 : 0]?.type ?? 'unknown';
      if (key === 'if' && (args.length === 2 || args[1]?.type === args[2]?.type)) result.type = args[1].type;
      if (key === 'element' && call.args.length >= 2) result.type = listElementType(call.args[0]);
      if (result.outputCount || result.outputExpressions) {
        const prefix = input.slice(0, call.start).trim();
        const suffix = input.slice(call.end).replace(/(?:\/\/|#)[^\n]*/gu, '').trim();
        const standalone = depth === 0 && !suffix && (!prefix || /^[\p{L}_][\p{L}\p{N}_{}']*\s*=$/u.test(prefix));
        const select = (index: number) => `Element(${result.expression},${index + (result.outputOffset ?? 0)})`;
        // GeoGebra supplies unused labels for subsequent outputs. An explicit
        // assignment labels the first object only.
        result.expression = result.outputExpressions
          ? standalone ? result.outputExpressions.join('\n') : result.outputExpressions[0]
          : standalone ? Array.from({ length: result.outputCount! }, (_, i) => select(i + 1)).join('\n') : select(1);
        result.outputExpressions = undefined;
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

const NAMED_BUILDERS = new Set([
  'conic', 'pretangential', 'cubicPolarConic', 'hessianCubic',
  'mixedPolar', 'jacobianCubic',
]);

/** A conservative execution plan. Ineligible tools retain the exact anonymous expansion. */
export const compileStudioPlan = (source: string, environment: CommandEnvironment,
  groupId: string): CompiledBindingPlan => {
  const capture: Capture = { ...createBindingCapture(), selected: [] };
  const expression = compileStudioCommand(source, environment, studioTools, capture);
  const selected = capture.selected.length === 1 ? capture.selected[0] : undefined;
  const eligible = Boolean(selected?.builder && NAMED_BUILDERS.has(selected.builder)
    && (selected.builder !== 'conic' || selected.args.length === 5 && selected.args.every((type) => ['line', 'segment', 'ray'].includes(type)))
    && (selected.builder !== 'pretangential' || selected.args.length === 3));
  return capture.lower(expression, groupId, eligible);
};
