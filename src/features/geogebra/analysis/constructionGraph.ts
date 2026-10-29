import { objectNodeId, FREE_OBJECT_ROOT_ID } from './graphTypes';
import type { ConstructionObjectInput, DependencyGraph, GraphEdge, GraphNode, ParseDiagnostic } from './graphTypes';
import { parseConstruction } from './expressionParser';
import { isInternalHelperName } from '../commands/custom/internalHelpers';

const edgeId = (source: string, target: string, kind: GraphEdge['kind']): string => `${kind}:${source}->${target}`;

const addEdge = (edges: Map<string, GraphEdge>, source: string, target: string, kind: GraphEdge['kind']): void => {
  if (source === target) return;
  const id = edgeId(source, target, kind);
  if (!edges.has(id)) edges.set(id, { id, source, target, kind });
};

export const buildDependencyGraph = (objects: readonly ConstructionObjectInput[], generatedAt = Date.now()): DependencyGraph => {
  const names = objects.map((object) => object.name);
  const nodes: GraphNode[] = [{
    id: FREE_OBJECT_ROOT_ID,
    name: FREE_OBJECT_ROOT_ID,
    label: 'Free objects',
    objectType: 'root',
    commandString: null,
    parsed: null,
    dependencyStatus: 'free',
    diagnostics: [],
    isSentinel: true,
  }];
  const edges = new Map<string, GraphEdge>();

  objects.forEach((object) => {
    const diagnostics: ParseDiagnostic[] = object.readError
      ? [{ message: object.readError, severity: 'error' }]
      : [];
    const parsed = object.readError ? null : parseConstruction(object.commandString, names);
    const dependencyStatus: GraphNode['dependencyStatus'] = object.readError
      ? 'unavailable'
      : parsed?.status === 'empty' ? 'free'
        : parsed?.status === 'partial' ? 'partial'
          : parsed?.status === 'failed' ? 'partial' : 'parsed';
    const node: GraphNode = {
      id: objectNodeId(object.name),
      name: object.name,
      label: object.name,
      objectType: object.objectType,
      commandString: object.commandString,
      parsed,
      coordinates: object.coordinates,
      coordinateError: object.coordinateError,
      dependencyStatus,
      diagnostics: [...diagnostics, ...(parsed?.diagnostics ?? []), ...(object.coordinateError ? [{ message: object.coordinateError, severity: 'warning' as const }] : [])],
    };
    nodes.push(node);

    if (object.readError || parsed?.status === 'empty' || !parsed?.dependencies.length) {
      addEdge(edges, FREE_OBJECT_ROOT_ID, node.id, 'fallback');
      return;
    }
    parsed.dependencies.forEach((dependency) => addEdge(edges, objectNodeId(dependency), node.id, 'dependency'));
  });

  return { rootId: FREE_OBJECT_ROOT_ID, nodes, edges: [...edges.values()], generatedAt };
};

/** Hide implementation nodes while preserving dependencies between user objects. */
export const collapseInternalHelpers = (graph: DependencyGraph): DependencyGraph => {
  const hidden = new Set(graph.nodes.filter((node) => isInternalHelperName(node.name)).map((node) => node.id));
  if (!hidden.size) return graph;
  const incoming = new Map<string, GraphEdge[]>();
  graph.edges.forEach((edge) => incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]));
  const edges = new Map<string, GraphEdge>();
  for (const node of graph.nodes) {
    if (hidden.has(node.id) || node.id === graph.rootId) continue;
    const visited = new Set<string>();
    const queue = [...(incoming.get(node.id) ?? [])];
    while (queue.length) {
      const edge = queue.shift()!;
      if (visited.has(edge.source)) continue;
      visited.add(edge.source);
      if (hidden.has(edge.source)) queue.push(...incoming.get(edge.source) ?? []);
      else {
        const kind = edge.source === graph.rootId ? 'fallback' : 'dependency';
        const id = edgeId(edge.source, node.id, kind);
        edges.set(id, { id, source: edge.source, target: node.id, kind });
      }
    }
  }
  return { ...graph, nodes: graph.nodes.filter((node) => !hidden.has(node.id)), edges: [...edges.values()] };
};

export interface GraphProjectionOptions {
  visibleTypes: Set<string> | 'all';
  visibleObjectNames?: ReadonlySet<string>;
  includeRoot?: boolean;
  compressHidden?: boolean;
}

const isVisible = (node: GraphNode, graph: DependencyGraph, options: GraphProjectionOptions): boolean => {
  if (node.id === graph.rootId) return options.includeRoot !== false;
  if (options.visibleObjectNames?.has(node.name)) return true;
  return options.visibleTypes === 'all' || (node.objectType !== null && options.visibleTypes.has(node.objectType));
};

export const projectGraph = (graph: DependencyGraph, options: GraphProjectionOptions): DependencyGraph => {
  const visibleNodes = graph.nodes.filter((node) => isVisible(node, graph, options));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  if (!options.compressHidden) {
    return { ...graph, nodes: visibleNodes, edges: graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) };
  }

  const outgoing = new Map<string, GraphEdge[]>();
  graph.edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]));
  const edges = new Map<string, GraphEdge>();

  visibleNodes.forEach((sourceNode) => {
    const queue = [...(outgoing.get(sourceNode.id) ?? []).map((edge) => ({ edge, path: new Set([sourceNode.id]) }))];
    while (queue.length > 0) {
      const item = queue.shift()!;
      const targetNode = graph.nodes.find((node) => node.id === item.edge.target);
      if (!targetNode || item.path.has(targetNode.id)) continue;
      if (visibleIds.has(targetNode.id)) {
        const kind: GraphEdge['kind'] = item.edge.kind === 'fallback' ? 'fallback' : 'dependency';
        addEdge(edges, sourceNode.id, targetNode.id, kind);
        continue;
      }
      const nextPath = new Set(item.path);
      nextPath.add(targetNode.id);
      (outgoing.get(targetNode.id) ?? []).forEach((edge) => queue.push({ edge, path: nextPath }));
    }
  });

  return { ...graph, nodes: visibleNodes, edges: [...edges.values()] };
};
