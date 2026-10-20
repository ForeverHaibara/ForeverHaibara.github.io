export interface ProofEquation {
  domain: 'angle' | 'length-add' | 'length-product';
  terms: Array<{ variable: string; coefficient: string }>;
}
export interface ProofNode {
  id: string;
  kind: 'assumption' | 'geometry' | 'algebra' | 'guard' | 'gap' | 'contradiction';
  rule: string;
  premises: Array<{ id: string; coefficient: string }>;
  equation?: ProofEquation;
  predicate?: string;
  sourceIds?: string[];
  points?: string[];
  triangles?: string[][];
  orientation?: number;
  ratio?: string;
  sign?: number;
  lift?: number;
}
export interface ReadableProof {
  version: 1;
  mode: 'ddar' | 'hypothetical';
  nodes: ProofNode[];
  conclusions: Array<{ predicate?: string; nodeId: string | null; backendKnown: boolean; status: 'recorded' | 'assumed' | 'unexplained' | 'not-derived' }>;
  assumptionIds: string[];
  contradictionIds: string[];
  gapIds: string[];
  guardIds: string[];
  algebraReplay: { checked: number; valid: boolean; errors: string[] };
  witnessFailures: Array<{ predicate: string; message: string }>;
  limited: boolean;
  explanation: 'recorded' | 'partial';
  certificate: null;
}
