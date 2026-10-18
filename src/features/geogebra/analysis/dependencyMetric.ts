import type { DependencyGraph } from './graphTypes';
import type { DependencySeparation } from './geometryTypes';

// One named construction is one step regardless of its command or nested AST.
// Fan-in adds a modest cost for eliminating a function of many objects.
const INPUT_COST = 0.5;
const SPAN_SCALE = 8;
const INCOMPLETE_SCORE_LIMIT = 50;

export interface DependencyProfile {
  nodeIdsByName: Map<string, string>;
  canonicalIds: Map<string, string>;
  parents: Map<string, string[]>;
  stepCosts: Map<string, number>;
  completeIds: Set<string>;
  ancestorDistances: Map<string, Map<string, number>>;
  pairDistances: Map<string, Map<string, number>>;
}

export const buildDependencyProfile = (graph: DependencyGraph): DependencyProfile => {
  const nodes = graph.nodes.filter((node) => !node.isSentinel && node.id !== graph.rootId);
  const ids = new Set(nodes.map((node) => node.id));
  const rawParents = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  const children = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  graph.edges.forEach((edge) => {
    // The UI sentinel is not a shared ancestor of independent free objects.
    if (edge.kind !== 'dependency' || !ids.has(edge.source) || !ids.has(edge.target)) return;
    rawParents.get(edge.target)!.add(edge.source);
    children.get(edge.source)!.add(edge.target);
  });

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const remaining = new Map(nodes.map((node) => [node.id, rawParents.get(node.id)!.size]));
  const queue = nodes.filter((node) => remaining.get(node.id) === 0).map((node) => node.id);
  const canonicalIds = new Map<string, string>();
  const completeIds = new Set<string>();
  // Topological propagation also marks cycles and all their descendants incomplete.
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const node = nodesById.get(id)!;
    const parents = [...rawParents.get(id)!];
    const complete = (node.dependencyStatus === 'free' || node.dependencyStatus === 'parsed')
      && !node.parsed?.dependencies.includes(node.name)
      && parents.every((parent) => completeIds.has(parent));
    if (complete) completeIds.add(id);
    // Only syntactic identity aliases are free. An arbitrary unary f(A) is a step.
    const alias = complete && node.parsed?.ast?.kind === 'reference' && parents.length === 1;
    canonicalIds.set(id, alias ? canonicalIds.get(parents[0])! : id);
    children.get(id)!.forEach((child) => {
      const count = remaining.get(child)! - 1;
      remaining.set(child, count);
      if (count === 0) queue.push(child);
    });
  }
  nodes.forEach((node) => {
    if (!canonicalIds.has(node.id)) canonicalIds.set(node.id, node.id);
  });

  const parents = new Map<string, string[]>();
  const stepCosts = new Map<string, number>();
  nodes.forEach((node) => {
    const id = canonicalIds.get(node.id)!;
    if (id !== node.id) return;
    const inputs = [...new Set([...rawParents.get(id)!].map((parent) => canonicalIds.get(parent)!))].sort();
    parents.set(id, inputs);
    stepCosts.set(id, inputs.length > 0 ? 1 + INPUT_COST * Math.log2(inputs.length) : 0);
  });

  return {
    nodeIdsByName: new Map(nodes.map((node) => [node.name, node.id])),
    canonicalIds, parents, stepCosts, completeIds,
    ancestorDistances: new Map(), pairDistances: new Map(),
  };
};

interface DistanceEntry { id: string; distance: number; }

// A small binary heap keeps lazy ancestor searches efficient on deep constructions.
class DistanceQueue {
  private entries: DistanceEntry[] = [];

  public push(entry: DistanceEntry): void {
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.entries[parent].distance <= entry.distance) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }

  public pop(): DistanceEntry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!last || this.entries.length === 0) return first;
    let index = 0;
    while (2 * index + 1 < this.entries.length) {
      let child = 2 * index + 1;
      if (child + 1 < this.entries.length && this.entries[child + 1].distance < this.entries[child].distance) child += 1;
      if (last.distance <= this.entries[child].distance) break;
      this.entries[index] = this.entries[child];
      index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

const distancesToAncestors = (profile: DependencyProfile, id: string): Map<string, number> => {
  const cached = profile.ancestorDistances.get(id);
  if (cached) return cached;
  // Including the object itself fixes the empty-ancestor/direct-parent blind spot.
  const distances = new Map([[id, 0]]);
  const queue = new DistanceQueue();
  queue.push({ id, distance: 0 });
  for (let entry = queue.pop(); entry; entry = queue.pop()) {
    if (entry.distance !== distances.get(entry.id)) continue;
    const nextDistance = entry.distance + (profile.stepCosts.get(entry.id) ?? 0);
    for (const parent of profile.parents.get(entry.id) ?? []) {
      if (nextDistance >= (distances.get(parent) ?? Infinity)) continue;
      distances.set(parent, nextDistance);
      queue.push({ id: parent, distance: nextDistance });
    }
  }
  profile.ancestorDistances.set(id, distances);
  return distances;
};

const connectionDistance = (profile: DependencyProfile, left: string, right: string): number => {
  const cached = profile.pairDistances.get(left)?.get(right);
  if (cached !== undefined) return cached;
  const leftDistances = distancesToAncestors(profile, left);
  const rightDistances = distancesToAncestors(profile, right);
  const [smaller, larger] = leftDistances.size < rightDistances.size
    ? [leftDistances, rightDistances] : [rightDistances, leftDistances];
  let distance = Infinity;
  smaller.forEach((cost, ancestor) => {
    const otherCost = larger.get(ancestor);
    if (otherCost !== undefined) distance = Math.min(distance, cost + otherCost);
  });
  if (!profile.pairDistances.has(left)) profile.pairDistances.set(left, new Map());
  if (!profile.pairDistances.has(right)) profile.pairDistances.set(right, new Map());
  profile.pairDistances.get(left)!.set(right, distance);
  profile.pairDistances.get(right)!.set(left, distance);
  return distance;
};

export const measureDependencySeparation = (profile: DependencyProfile, pointNames: readonly string[]): DependencySeparation => {
  const names = [...new Set(pointNames)];
  const originalIds = names.map((name) => profile.nodeIdsByName.get(name));
  const ids = [...new Set(originalIds.flatMap((id) => id ? [profile.canonicalIds.get(id)!] : []))].sort();
  const completeCount = originalIds.filter((id) => id && profile.completeIds.has(id)).length;
  const dependencyCoverage = names.length > 0 ? completeCount / names.length : 0;

  // Prim's minimum spanning forest: use the longest necessary link, not an
  // all-pairs mean that is diluted by the many input/input pairs of Q=f(A,...).
  // Paths may ascend to a common ancestor, never through unrelated descendants.
  const remaining = new Set(ids);
  const best = new Map(ids.map((id) => [id, Infinity]));
  let connectedComponents = 0;
  let constructionSpan = 0;
  while (remaining.size > 0) {
    let next = remaining.values().next().value as string;
    for (const id of remaining) if (best.get(id)! < best.get(next)!) next = id;
    const distance = best.get(next)!;
    if (!Number.isFinite(distance)) connectedComponents += 1;
    else constructionSpan = Math.max(constructionSpan, distance);
    remaining.delete(next);
    for (const id of remaining) best.set(id, Math.min(best.get(id)!, connectionDistance(profile, next, id)));
  }
  return {
    constructionSpan: connectedComponents > 1 ? null : constructionSpan,
    connectedComponents,
    dependencyCoverage,
    pointCount: ids.length,
  };
};

export const scoreDependencySeparation = (metric: DependencySeparation): number => {
  if (metric.pointCount < 2) return 0;
  const score = metric.constructionSpan === null ? 100
    : 100 * (1 - Math.exp(-Math.max(0, metric.constructionSpan - 1) / SPAN_SCALE));
  // Missing dependency information is not evidence of a valuable new branch.
  return Math.max(0, Math.min(metric.dependencyCoverage < 1 ? INCOMPLETE_SCORE_LIMIT : 100, score));
};

export const explainDependencySeparation = (metric: DependencySeparation): string => {
  const messages: string[] = [];
  if (metric.constructionSpan === null) messages.push(`${metric.connectedComponents} construction branches without a shared upstream object`);
  else if (metric.constructionSpan <= 4) messages.push('nearby construction dependencies; relatively familiar');
  else messages.push('more distant construction dependencies');
  if (metric.dependencyCoverage < 1) messages.push('incomplete or cyclic dependencies; value capped at 50');
  return messages.join('; ');
};
