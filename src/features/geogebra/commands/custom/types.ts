export type GeometryType = 'point' | 'line' | 'segment' | 'ray' | 'circle' | 'conic' | 'number' | 'list' | 'vector' | 'function' | 'unknown';
export type ParameterType = GeometryType | 'lineLike' | 'pointOrLine';

export interface ToolOverload {
  params: Array<{ name: string; type: ParameterType }>;
  returns: GeometryType;
  /** Expression templates use $parameter and $local placeholders, never textual label replacement. */
  expression?: string;
  locals?: Array<{ name: string; expression: string }>;
  builder?: string;
  variadic?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  overloads: ToolOverload[];
}

export interface ToolLibrary {
  schemaVersion: 1;
  id: string;
  version: string;
  tools: ToolDefinition[];
}

export interface TypedExpression {
  expression: string;
  type: GeometryType;
}

export type ExpressionBuilder = (args: readonly TypedExpression[], allocate: () => string) => string;

export interface CommandEnvironment {
  objects: Map<string, GeometryType>;
  macros: Set<string>;
  macroTypes?: Map<string, GeometryType>;
}

