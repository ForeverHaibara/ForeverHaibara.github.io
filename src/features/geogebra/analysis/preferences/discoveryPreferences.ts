import { ALL_RELATION_KINDS, DEFAULT_DISCOVERY_OPTIONS, DEFAULT_RELATION_KINDS } from '../relations/catalog';
import type { DiscoveryOptions, GeometryRelationKind } from '../relations/catalog';

export interface DiscoveryPreferences {
  automatic: boolean;
  options: DiscoveryOptions;
  /** Legacy stored display fields. The catalog now owns per-view list filters;
   * these remain readable for older saved preference schemas. */
  visibleKinds: GeometryRelationKind[];
  minimumValue: number;
  knownKinds: GeometryRelationKind[];
}
export const DISCOVERY_PREFERENCES_KEY = 'geogebra-discovery-preferences-v1';
export const defaultDiscoveryPreferences = (): DiscoveryPreferences => ({ automatic: true,
  options: { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: [...DEFAULT_RELATION_KINDS] }, visibleKinds: [...ALL_RELATION_KINDS], minimumValue: 0, knownKinds: [...ALL_RELATION_KINDS] });

// The first stored schema did not record catalog membership. Only a complete
// selection of its ten types opts into new defaults during this one-time migration.
const INITIAL_KINDS: GeometryRelationKind[] = ['collinear', 'parallel', 'perpendicular', 'concyclic', 'coincident-points',
  'equal-lengths', 'equal-angles', 'similar-triangles', 'congruent-triangles', 'direction-space'];

export const normalizeDiscoveryPreferences = (value: unknown): DiscoveryPreferences => {
  const result = defaultDiscoveryPreferences();
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  const kinds = (input: unknown, fallback: readonly GeometryRelationKind[]) => Array.isArray(input)
    ? ALL_RELATION_KINDS.filter((kind) => input.includes(kind)) : [...fallback];
  const migrate = (input: unknown, fallback: readonly GeometryRelationKind[], defaults: readonly GeometryRelationKind[]) => {
    const selection = kinds(input, fallback);
    if (!Array.isArray(input) || input.length === 0) return selection;
    const known = Array.isArray(source.knownKinds) ? kinds(source.knownKinds, []) : INITIAL_KINDS;
    const adoptNewDefaults = Array.isArray(source.knownKinds) || known.every((kind) => selection.includes(kind));
    return adoptNewDefaults ? ALL_RELATION_KINDS.filter((kind) => selection.includes(kind) || !known.includes(kind) && defaults.includes(kind)) : selection;
  };
  if (typeof source.automatic === 'boolean') result.automatic = source.automatic;
  result.visibleKinds = migrate(source.visibleKinds, result.visibleKinds, ALL_RELATION_KINDS);
  if (typeof source.minimumValue === 'number' && Number.isFinite(source.minimumValue)) result.minimumValue = Math.round(Math.max(0, Math.min(100, source.minimumValue)));
  if (source.options && typeof source.options === 'object') {
    const options = source.options as Record<string, unknown>;
    result.options.enabledKinds = migrate(options.enabledKinds, result.options.enabledKinds, DEFAULT_RELATION_KINDS);
    if (typeof options.compressConsequences === 'boolean') result.options.compressConsequences = options.compressConsequences;
    for (const key of ['maxTriangles', 'maxAngles', 'maxComparisons', 'maxModels', 'maxRelations'] as const) {
      const number = options[key];
      if (typeof number === 'number' && Number.isFinite(number)) result.options[key] = Math.round(Math.max(0, Math.min(key === 'maxModels' ? 12 : 1000000, number)));
    }
  }
  return result;
};
export const readDiscoveryPreferences = (): DiscoveryPreferences => {
  try { return normalizeDiscoveryPreferences(JSON.parse(localStorage.getItem(DISCOVERY_PREFERENCES_KEY) ?? 'null')); }
  catch { return defaultDiscoveryPreferences(); }
};
export const saveDiscoveryPreferences = (preferences: DiscoveryPreferences): boolean => {
  try { localStorage.setItem(DISCOVERY_PREFERENCES_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
};
