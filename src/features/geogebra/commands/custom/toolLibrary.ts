import definitions from './library.json';
import { GEOMETRY_BUILDERS } from './geometryBuilders';
import type { GeometryType, ParameterType, ToolDefinition, ToolLibrary, ToolOverload, TypedExpression } from './types';

const parameterTypes = new Set(['point', 'line', 'segment', 'ray', 'circle', 'conic', 'implicitCurve', 'number', 'list', 'vector', 'function', 'unknown', 'lineLike', 'pointOrLine']);
const resultTypes = new Set([...parameterTypes].filter((type) => !['lineLike', 'pointOrLine'].includes(type)));

export const validateToolLibrary = (value: unknown): ToolLibrary => {
  const library = value as ToolLibrary;
  if (library?.schemaVersion !== 1 || !library.id || !library.version || !Array.isArray(library.tools)) throw new Error('Invalid tool library header.');
  const names = new Set<string>();
  for (const tool of library.tools) {
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(tool.name) || names.has(tool.name.toLowerCase()) || !tool.description || !tool.overloads?.length) throw new Error(`Invalid or duplicate tool: ${tool.name}`);
    names.add(tool.name.toLowerCase());
    for (const overload of tool.overloads) {
      if (!Array.isArray(overload.params) || overload.variadic && overload.params.length === 0) throw new Error(`Invalid parameters: ${tool.name}`);
      const parameters = new Set(overload.params.map((param) => param.name));
      if (parameters.size !== overload.params.length || overload.params.some((param) => !parameterTypes.has(param.type) || !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(param.name)) || !resultTypes.has(overload.returns)) throw new Error(`Invalid signature: ${tool.name}`);
      if ([overload.expression, overload.builder, overload.compose].filter((implementation) => implementation !== undefined).length !== 1
        || overload.expression !== undefined && (typeof overload.expression !== 'string' || !overload.expression.trim())
        || overload.compose !== undefined && !(typeof overload.compose === 'string' ? overload.compose.trim() : Array.isArray(overload.compose) && overload.compose.length > 0 && overload.compose.every((expression) => typeof expression === 'string' && expression.trim()))
        || overload.builder !== undefined && (typeof overload.builder !== 'string' || !Object.prototype.hasOwnProperty.call(GEOMETRY_BUILDERS, overload.builder))) throw new Error(`Invalid implementation: ${tool.name}`);
      const scope = new Set(parameters);
      const expressions = overload.compose === undefined ? [overload.expression ?? ''] : [overload.compose].flat();
      for (const local of [...(overload.locals ?? []), ...expressions.map((expression) => ({ name: '', expression }))]) {
        for (const match of local.expression.matchAll(/\$([\p{L}_][\p{L}\p{N}_]*)/gu)) if (!scope.has(match[1])) throw new Error(`Unknown or forward local reference: ${match[0]} in ${tool.name}`);
        if (local.name) { if (scope.has(local.name)) throw new Error(`Duplicate local: ${local.name}`); scope.add(local.name); }
      }
    }
  }
  return library;
};

export const studioToolLibrary = validateToolLibrary(definitions);
export const studioTools = new Map(studioToolLibrary.tools.map((tool) => [tool.name.toLowerCase(), tool]));

const scoreType = (expected: ParameterType, actual: GeometryType): number => {
  if (expected === 'unknown') return 0;
  if (actual === expected) return 4;
  if (expected === 'conic' && actual === 'circle') return 3;
  if (expected === 'lineLike' && ['line', 'segment', 'ray'].includes(actual)) return 2;
  if (expected === 'pointOrLine' && ['point', 'line', 'segment', 'ray'].includes(actual)) return 1;
  return -1;
};

export const selectOverload = (tool: ToolDefinition, args: readonly TypedExpression[]): ToolOverload | undefined => {
  const candidates = tool.overloads.flatMap((overload) => {
    if (!overload.variadic && args.length !== overload.params.length || overload.variadic && args.length < overload.params.length) return [];
    const scores = args.map((arg, i) => scoreType(overload.params[Math.min(i, overload.params.length - 1)].type, arg.type));
    return scores.some((score) => score < 0) ? [] : [{ overload, score: scores.reduce((sum, score) => sum + score, 0) }];
  }).sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) throw new Error(`Ambiguous overload: ${tool.name}`);
  return candidates[0]?.overload;
};

export const expandTool = (overload: ToolOverload, args: readonly TypedExpression[], allocate: () => string,
  compose?: (expression: string, bindings: ReadonlyMap<string, TypedExpression>) => TypedExpression): TypedExpression => {
  if (overload.builder) {
    const built = GEOMETRY_BUILDERS[overload.builder](args, allocate);
    return { ...(typeof built === 'string' ? { expression: built } : built), type: overload.returns };
  }
  if (overload.compose !== undefined) {
    if (!compose) throw new Error('A composition compiler is required.');
    const bindings = new Map(overload.params.map((param, i) => [param.name, args[i]]));
    for (const local of overload.locals ?? []) bindings.set(local.name, compose(local.expression, bindings));
    const expressions = [overload.compose].flat().map((expression) => compose(expression, bindings).expression);
    return { expression: expressions[0], ...(expressions.length > 1 ? { outputExpressions: expressions } : {}), type: overload.returns };
  }
  const bindings = new Map(overload.params.map((param, i) => [param.name, args[i].expression]));
  const substitute = (expression: string) => expression.replace(/\$([\p{L}_][\p{L}\p{N}_]*)/gu, (_, name: string) => `(${bindings.get(name)!})`);
  for (const local of overload.locals ?? []) bindings.set(local.name, substitute(local.expression));
  return { expression: substitute(overload.expression!), type: overload.returns };
};

export const toolSignature = (tool: ToolDefinition, overload: ToolOverload) => `${tool.name}(${overload.params.map((param) => `${param.name}: ${param.type}${overload.variadic ? '…' : ''}`).join(', ')})`;
