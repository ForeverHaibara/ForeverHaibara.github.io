import definitions from './library.json';
import { GEOMETRY_BUILDERS } from './builders';
import type { GeometryType, ParameterType, ResolvedToolLibrary, ToolDefinition, ToolLibrary, ToolOverload, TypedExpression } from './types';

const parameterTypes = new Set(['point', 'line', 'segment', 'ray', 'circle', 'conic', 'implicitCurve', 'number', 'list', 'vector', 'function', 'unknown', 'lineLike', 'pointOrLine', 'catalogId']);
const resultTypes = new Set([...parameterTypes].filter((type) => !['lineLike', 'pointOrLine', 'catalogId'].includes(type)));
const validName = (name: unknown): name is string => typeof name === 'string' && /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name);

export const validateToolLibrary = (value: unknown): ToolLibrary => {
  const library = value as ToolLibrary;
  if (library?.schemaVersion !== 1 || !library.id || !library.version || !Array.isArray(library.tools)) throw new Error('Invalid tool library header.');
  const names = new Set<string>();
  for (const tool of library.tools) {
    if (!validName(tool.name) || !tool.description || !tool.overloads?.length) throw new Error(`Invalid tool: ${tool.name}`);
    if (tool.aliases !== undefined && !Array.isArray(tool.aliases)) throw new Error(`Invalid aliases for tool: ${tool.name}`);
    for (const name of [tool.name, ...(tool.aliases ?? [])]) {
      if (!validName(name) || names.has(name.toLowerCase())) throw new Error(`Invalid or duplicate tool name or alias: ${String(name)}`);
      names.add(name.toLowerCase());
    }
    for (const overload of tool.overloads) {
      if (overload.requiresNamed !== undefined && (typeof overload.requiresNamed !== 'boolean' || !overload.builder)) throw new Error(`Invalid named execution requirement: ${tool.name}`);
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

/** Resolve once for dispatch, completion and audits; aliases share overload identity.
 * This also makes a composition cycle through an alias the same dependency cycle.
 * A flat alias list on the canonical entry cannot form alias chains.
 */
export const resolveToolAliases = (value: unknown): ResolvedToolLibrary => {
  const library = validateToolLibrary(value);
  return {
    ...library,
    tools: library.tools.flatMap(({ aliases = [], ...tool }) => [tool.name, ...aliases].map((name) => ({ ...tool, name, canonicalName: tool.name }))),
  };
};

/** Editable canonical definitions, retaining alias lists. */
export const studioToolCatalog = validateToolLibrary(definitions);
/** All callable names, including aliases, with the same shape used by consumers. */
export const studioToolLibrary = resolveToolAliases(studioToolCatalog);
export const studioTools = new Map(studioToolLibrary.tools.map((tool) => [tool.name.toLowerCase(), tool]));

const scoreType = (expected: ParameterType, actual: GeometryType): number => {
  if (expected === 'catalogId') return ['number', 'unknown'].includes(actual) ? 1 : -1;
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
  for (const [index, param] of overload.params.entries()) {
    if (param.type === 'catalogId' && args[index].literal === undefined)
      throw new Error(`${param.name} must be a positive integer literal or a quoted catalogue ID, e.g. 12 or "Q012". Sliders and expressions are not supported.`);
  }
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
