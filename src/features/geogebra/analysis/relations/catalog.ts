export const RELATION_CATALOG = [
  { kind: 'collinear', label: 'Collinear', symbol: '—', group: 'Basic', defaultEnabled: true },
  { kind: 'parallel', label: 'Parallel', symbol: '∥', group: 'Basic', defaultEnabled: true },
  { kind: 'perpendicular', label: 'Perpendicular', symbol: '⊥', group: 'Basic', defaultEnabled: true },
  { kind: 'concyclic', label: 'Concyclic', symbol: '○', group: 'Basic', defaultEnabled: true },
  { kind: 'coincident-points', label: 'Coincident points', symbol: '≈', group: 'Basic', defaultEnabled: true },
  { kind: 'midpoint', label: 'Midpoints', symbol: '½', group: 'Lengths', defaultEnabled: true },
  { kind: 'equal-lengths', label: 'Equal lengths', symbol: 'dist', group: 'Lengths', defaultEnabled: true },
  { kind: 'length-multiple', label: 'Length multiples', symbol: '×', group: 'Lengths', defaultEnabled: true },
  { kind: 'directed-angles', label: 'Directed angles (mod π)', symbol: '∡', group: 'Angles', defaultEnabled: true },
  { kind: 'equal-angles', label: 'Equal ordinary angles', symbol: '∠', group: 'Angles', defaultEnabled: true },
  { kind: 'angle-multiple', label: 'Double angles', symbol: '2∠', group: 'Angles', defaultEnabled: true },
  { kind: 'complementary-angles', label: 'Complementary angles', symbol: 'π/2', group: 'Angles', defaultEnabled: false },
  { kind: 'supplementary-angles', label: 'Supplementary angles', symbol: 'π', group: 'Angles', defaultEnabled: false },
  { kind: 'similar-triangles', label: 'Similar triangles', symbol: '∼', group: 'Triangles', defaultEnabled: true },
  { kind: 'congruent-triangles', label: 'Congruent triangles', symbol: '≅', group: 'Triangles', defaultEnabled: true },
  { kind: 'direction-space', label: 'Direction generators', symbol: '⟨ ⟩', group: 'Generators', defaultEnabled: true },
  { kind: 'length-space', label: 'Length generators', symbol: 'log', group: 'Generators', defaultEnabled: true },
] as const;
export type GeometryRelationKind = typeof RELATION_CATALOG[number]['kind'];
export const LEGACY_RELATION_KINDS: GeometryRelationKind[] = ['collinear', 'parallel', 'perpendicular', 'concyclic'];
export const ALL_RELATION_KINDS: GeometryRelationKind[] = RELATION_CATALOG.map((item) => item.kind);
export const DEFAULT_RELATION_KINDS: GeometryRelationKind[] = RELATION_CATALOG.filter((item) => item.defaultEnabled).map((item) => item.kind);
export const RELATION_GROUPS = [...new Set(RELATION_CATALOG.map((item) => item.group))].map((label) => ({
  label, items: RELATION_CATALOG.filter((item) => item.group === label),
}));
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
  enabledKinds: DEFAULT_RELATION_KINDS, maxTriangles: 8000, maxAngles: 20000,
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
