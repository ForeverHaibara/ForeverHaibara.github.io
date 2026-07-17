export type ParseStatus = 'parsed' | 'empty' | 'partial' | 'failed';

export type ExpressionNode =
  | { kind: 'literal'; value: string; raw: string }
  | { kind: 'reference'; name: string; raw: string }
  | { kind: 'identifier'; name: string; raw: string }
  | { kind: 'call'; callee: ExpressionNode; args: ExpressionNode[]; raw: string }
  | { kind: 'unary'; operator: string; operand: ExpressionNode; raw: string }
  | { kind: 'binary'; operator: string; left: ExpressionNode; right: ExpressionNode; raw: string }
  | { kind: 'sequence'; items: ExpressionNode[]; raw: string }
  | { kind: 'unknown'; raw: string };

export interface ParseDiagnostic {
  message: string;
  position?: number;
  severity: 'warning' | 'error';
}

export interface ParsedConstruction {
  ast: ExpressionNode | null;
  dependencies: string[];
  diagnostics: ParseDiagnostic[];
  status: ParseStatus;
  source: string;
}

export interface ConstructionObjectInput {
  name: string;
  objectType: string | null;
  commandString: string | null;
  readError?: string;
}

export const FREE_OBJECT_ROOT_ID = '__geogebra_free_objects__';

export const objectNodeId = (name: string): string => `object:${name}`;

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  objectType: string | null;
  commandString: string | null;
  parsed: ParsedConstruction | null;
  dependencyStatus: 'free' | 'parsed' | 'partial' | 'unavailable';
  diagnostics: ParseDiagnostic[];
  isSentinel?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'dependency' | 'fallback';
}

export interface DependencyGraph {
  rootId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  generatedAt: number;
}

