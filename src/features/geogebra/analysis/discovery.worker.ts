import { detectGeometryRelations } from './geometryRelations';
import type { DependencyGraph } from './graphTypes';
import type { DiscoveryOptions } from './relations/catalog';
import type { GeometryRelationResult } from './geometryTypes';

export interface DiscoveryRequest { graph: DependencyGraph; options: DiscoveryOptions; }
export type DiscoveryResponse = { result: GeometryRelationResult; error?: never } | { result?: never; error: string };
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<DiscoveryRequest>) => void) | null; postMessage(response: DiscoveryResponse): void };
scope.onmessage = ({ data }) => {
  try { scope.postMessage({ result: detectGeometryRelations(data.graph, data.graph.generatedAt, data.options) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Geometry discovery failed.' }); }
};
