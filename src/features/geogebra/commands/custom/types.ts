export type GeometryType = 'point' | 'line' | 'segment' | 'ray' | 'circle' | 'conic' | 'number' | 'list' | 'vector' | 'function' | 'unknown';
export type ParameterType = GeometryType | 'lineLike' | 'pointOrLine';

export interface ToolOverload {
  params: Array<{ name: string; type: ParameterType }>;
  returns: GeometryType;
  /** Expression templates use $parameter and $local placeholders, never textual label replacement. */
  expression?: string;
  /** Explicit site-tool composition; arrays produce independent geometric outputs. */
  compose?: string | string[];
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

export interface TypedExpression extends BuiltExpression {
  type: GeometryType;
}

export interface BuiltExpression {
  expression: string;
  /** Already scalar expressions, emitted separately only at statement level. */
  outputExpressions?: string[];
  /** A list-valued backend emitted as separate objects at statement level. */
  outputCount?: number;
  /** Optional typed sentinel elements preceding the actual outputs. */
  outputOffset?: number;
}

export type ExpressionBuilder = (args: readonly TypedExpression[], allocate: () => string) => string | BuiltExpression;

export interface CommandEnvironment {
  objects: Map<string, GeometryType>;
  macros: Set<string>;
  macroTypes?: Map<string, GeometryType>;
}

