export const RELATION_CATALOG = [
  { kind: 'collinear', label: 'Collinear', symbol: '—', group: 'Basic' },
  { kind: 'parallel', label: 'Parallel', symbol: '∥', group: 'Basic' },
  { kind: 'perpendicular', label: 'Perpendicular', symbol: '⊥', group: 'Basic' },
  { kind: 'concyclic', label: 'Concyclic', symbol: '○', group: 'Basic' },
  { kind: 'coincident-points', label: 'Coincident points', symbol: '≈', group: 'Basic' },
  { kind: 'equal-lengths', label: 'Equal lengths', symbol: '| |', group: 'Metric' },
  { kind: 'equal-angles', label: 'Equal angles', symbol: '∠', group: 'Metric' },
  { kind: 'similar-triangles', label: 'Similar triangles', symbol: '∼', group: 'Triangles' },
  { kind: 'congruent-triangles', label: 'Congruent triangles', symbol: '≅', group: 'Triangles' },
  { kind: 'direction-space', label: 'Direction generators', symbol: '⟨ ⟩', group: 'Generators' },
] as const;
export type GeometryRelationKind = typeof RELATION_CATALOG[number]['kind'];
export const LEGACY_RELATION_KINDS: GeometryRelationKind[] = ['collinear', 'parallel', 'perpendicular', 'concyclic'];
export const ALL_RELATION_KINDS: GeometryRelationKind[] = RELATION_CATALOG.map((item) => item.kind);
export const relationLabel = (kind: GeometryRelationKind): string => RELATION_CATALOG.find((item) => item.kind === kind)!.label;

export interface DiscoveryOptions {
  enabledKinds: readonly GeometryRelationKind[];
  maxTriangles: number;
  maxAngles: number;
  maxComparisons: number;
  maxModels: number;
  maxRelations: number;
  compressConsequences: boolean;
}
export const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
  enabledKinds: ALL_RELATION_KINDS, maxTriangles: 8000, maxAngles: 20000,
  maxComparisons: 200000, maxModels: 6, maxRelations: 500, compressConsequences: true,
};

export class DiscoveryBudget {
  private counts = new Map<string, number>();
  private limited = new Set<string>();
  constructor(private diagnostics: string[]) {}
  take(resource: string, limit: number): boolean {
    const count = this.counts.get(resource) ?? 0;
    if (count >= limit) {
      if (!this.limited.has(resource)) this.diagnostics.push(`${resource} limit (${limit}) reached; results are partial.`);
      this.limited.add(resource); return false;
    }
    this.counts.set(resource, count + 1); return true;
  }
  used(resource: string): number { return this.counts.get(resource) ?? 0; }
  note(message: string): void { if (!this.diagnostics.includes(message)) this.diagnostics.push(message); }
}
