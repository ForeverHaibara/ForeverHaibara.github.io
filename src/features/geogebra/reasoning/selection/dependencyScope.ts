import type { ReasoningObject } from '../ir/types';

export interface DependencyContext {
  ordered: ReasoningObject[];
  ancestors: Map<string, Set<string>>;
  distances: Map<string, Map<string, number>>;
  incomplete: Set<string>;
  uncertain: Set<string>;
}

/** Stable topological order; malformed dependencies never become free inputs. */
export const buildDependencyContext = (objects: readonly ReasoningObject[]): DependencyContext => {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const children = new Map<string, string[]>(); const remaining = new Map<string, number>();
  const incomplete = new Set<string>(); const uncertain = new Set<string>();
  for (const object of objects) {
    const parents = [...new Set(object.dependencies)];
    remaining.set(object.id, parents.filter((id) => byId.has(id)).length);
    if (object.dependencyStatus === 'partial') uncertain.add(object.id);
    if (object.dependencyStatus === 'unavailable' || parents.some((id) => !byId.has(id))) incomplete.add(object.id);
    for (const id of parents) children.set(id, [...(children.get(id) ?? []), object.id]);
  }
  const queue = objects.filter((object) => !remaining.get(object.id));
  const inputOrder = new Map(objects.map((object, i) => [object.id, i]));
  const ordered: ReasoningObject[] = []; const ancestors = new Map<string, Set<string>>();
  const distances = new Map<string, Map<string, number>>();
  while (queue.length) {
    queue.sort((a, b) => inputOrder.get(a.id)! - inputOrder.get(b.id)!);
    const object = queue.shift()!; ordered.push(object);
    const scope = new Map<string, number>();
    for (const parent of object.dependencies) {
      scope.set(parent, Math.min(scope.get(parent) ?? Infinity, 1));
      if (incomplete.has(parent)) incomplete.add(object.id);
      if (uncertain.has(parent)) uncertain.add(object.id);
      for (const [id, distance] of distances.get(parent) ?? []) scope.set(id, Math.min(scope.get(id) ?? Infinity, distance + 1));
    }
    distances.set(object.id, scope); ancestors.set(object.id, new Set(scope.keys()));
    for (const child of children.get(object.id) ?? []) {
      const count = remaining.get(child)! - 1; remaining.set(child, count);
      if (count === 0) queue.push(byId.get(child)!);
    }
  }
  const visited = new Set(ordered.map((object) => object.id));
  for (const object of objects) if (!visited.has(object.id)) { incomplete.add(object.id); ordered.push(object); }
  return { ordered, ancestors, distances, incomplete, uncertain };
};

export const hasPointCoordinates = (object: ReasoningObject): boolean => Boolean(object.coordinates
  && Number.isFinite(object.coordinates.x) && Number.isFinite(object.coordinates.y));
