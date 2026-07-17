import { objectNodeId } from './graphTypes';
import type { DependencyGraph } from './graphTypes';
import type { DependencySeparation } from './geometryTypes';

export interface DependencyProfile {
  depth: Map<string, number>;
  ancestors: Map<string, Set<string>>;
  nodeIdsByName: Map<string, string>;
}

const buildStronglyConnectedComponents = (graph: DependencyGraph): Map<string, number> => {
  const outgoing = new Map<string, string[]>();
  graph.nodes.forEach((node) => outgoing.set(node.id, []));
  graph.edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]));

  const indexById = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const componentById = new Map<string, number>();
  let nextIndex = 0;
  let componentCount = 0;

  const visit = (id: string): void => {
    indexById.set(id, nextIndex);
    lowLink.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    (outgoing.get(id) ?? []).forEach((target) => {
      if (!indexById.has(target)) {
        visit(target);
        lowLink.set(id, Math.min(lowLink.get(id)!, lowLink.get(target)!));
      } else if (onStack.has(target)) {
        lowLink.set(id, Math.min(lowLink.get(id)!, indexById.get(target)!));
      }
    });

    if (lowLink.get(id) !== indexById.get(id)) return;
    while (true) {
      const member = stack.pop()!;
      onStack.delete(member);
      componentById.set(member, componentCount);
      if (member === id) break;
    }
    componentCount += 1;
  };

  graph.nodes.forEach((node) => {
    if (!indexById.has(node.id)) visit(node.id);
  });
  return componentById;
};

const weightedSetSum = (values: Iterable<string>, depth: Map<string, number>): number => {
  let total = 0;
  for (const value of values) {
    const level = depth.get(value) ?? 0;
    if (level > 0) total += level / (1 + level);
  }
  return total;
};

export const buildDependencyProfile = (graph: DependencyGraph): DependencyProfile => {
  const componentById = buildStronglyConnectedComponents(graph);
  const componentMembers = new Map<number, string[]>();
  componentById.forEach((component, id) => componentMembers.set(component, [...(componentMembers.get(component) ?? []), id]));
  const parents = new Map<number, Set<number>>();
  graph.edges.forEach((edge) => {
    const source = componentById.get(edge.source);
    const target = componentById.get(edge.target);
    if (source === undefined || target === undefined || source === target) return;
    parents.set(target, new Set([...(parents.get(target) ?? []), source]));
  });

  const rootComponent = componentById.get(graph.rootId);
  const depthByComponent = new Map<number, number>();
  const depthOf = (component: number, visiting = new Set<number>()): number => {
    const cached = depthByComponent.get(component);
    if (cached !== undefined) return cached;
    if (visiting.has(component)) return 0;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(component);
    const level = Math.max(0, ...[...(parents.get(component) ?? [])].map((parent: number) => depthOf(parent, nextVisiting))) + (component === rootComponent ? 0 : 1);
    depthByComponent.set(component, level);
    return level;
  };
  componentMembers.forEach((_, component) => depthOf(component));

  const ancestorsByComponent = new Map<number, Set<number>>();
  const ancestorsOf = (component: number, visiting = new Set<number>()): Set<number> => {
    const cached = ancestorsByComponent.get(component);
    if (cached) return cached;
    if (visiting.has(component)) return new Set();
    const result = new Set<number>();
    const nextVisiting = new Set(visiting);
    nextVisiting.add(component);
    (parents.get(component) ?? []).forEach((parent) => {
      result.add(parent);
      ancestorsOf(parent, nextVisiting).forEach((ancestor) => result.add(ancestor));
    });
    ancestorsByComponent.set(component, result);
    return result;
  };

  const depth = new Map<string, number>();
  const ancestors = new Map<string, Set<string>>();
  graph.nodes.forEach((node) => {
    const component = componentById.get(node.id)!;
    depth.set(node.id, depthByComponent.get(component) ?? 0);
    const ancestorIds = new Set<string>();
    ancestorsOf(component).forEach((ancestorComponent) => {
      (componentMembers.get(ancestorComponent) ?? []).forEach((ancestorId) => {
        if (ancestorId !== graph.rootId) ancestorIds.add(ancestorId);
      });
    });
    ancestors.set(node.id, ancestorIds);
  });

  return {
    depth,
    ancestors,
    nodeIdsByName: new Map(graph.nodes.filter((node) => !node.isSentinel).map((node) => [node.name, node.id])),
  };
};

export const measureDependencySeparation = (profile: DependencyProfile, pointNames: readonly string[]): DependencySeparation => {
  const ids = pointNames.map((name) => profile.nodeIdsByName.get(name)).filter((id): id is string => Boolean(id));
  const pairSeparations: number[] = [];
  let sharedAncestorWeight = 0;
  let unionWeight = 0;
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      const leftAncestors = profile.ancestors.get(ids[left]) ?? new Set<string>();
      const rightAncestors = profile.ancestors.get(ids[right]) ?? new Set<string>();
      const intersection = new Set([...leftAncestors].filter((ancestor) => rightAncestors.has(ancestor)));
      const union = new Set([...leftAncestors, ...rightAncestors]);
      const intersectionWeight = weightedSetSum(intersection, profile.depth);
      const pairUnionWeight = weightedSetSum(union, profile.depth);
      pairSeparations.push(pairUnionWeight > 0 ? 1 - intersectionWeight / pairUnionWeight : 1);
      sharedAncestorWeight += intersectionWeight;
      unionWeight += pairUnionWeight;
    }
  }

  const branchDiversity = pairSeparations.length > 0 ? pairSeparations.reduce((sum, value) => sum + value, 0) / pairSeparations.length : 0;
  const meanDepth = ids.length > 0 ? ids.reduce((sum, id) => sum + (profile.depth.get(id) ?? 0), 0) / ids.length : 0;
  const depthFactor = 1 - Math.exp(-meanDepth / 3);
  let independentPairs = 0;
  let pairCount = 0;
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      pairCount += 1;
      const leftAncestors = profile.ancestors.get(ids[left]) ?? new Set<string>();
      const rightAncestors = profile.ancestors.get(ids[right]) ?? new Set<string>();
      if (!leftAncestors.has(ids[right]) && !rightAncestors.has(ids[left])) independentPairs += 1;
    }
  }
  const independenceFactor = pairCount > 0 ? independentPairs / pairCount : 0;
  return { branchDiversity, depthFactor, independenceFactor, meanDepth, sharedAncestorWeight: unionWeight > 0 ? sharedAncestorWeight / unionWeight : 0 };
};

export const scoreDependencySeparation = (metric: DependencySeparation): number => Math.max(0, Math.min(100, 100 * (0.55 * metric.branchDiversity + 0.25 * metric.depthFactor + 0.20 * metric.independenceFactor)));

export const explainDependencySeparation = (metric: DependencySeparation): string => {
  const messages: string[] = [];
  if (metric.branchDiversity >= 0.65) messages.push('independent construction branches');
  else if (metric.sharedAncestorWeight >= 0.65) messages.push('many shared upstream objects');
  if (metric.depthFactor >= 0.55) messages.push('deeply constructed points');
  if (metric.independenceFactor < 0.5) messages.push('direct dependency lowers novelty');
  return messages.length > 0 ? messages.join('; ') : 'limited dependency evidence';
};

export const pointNodeId = (name: string): string => objectNodeId(name);
