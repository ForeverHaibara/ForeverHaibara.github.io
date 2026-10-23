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
export const DISCOVERY_BUDGET_FIELDS = {
  maxTriangles: { label: 'Triangle candidates', help: 'Maximum triangle candidates per discovery run.', min: 0, max: 1000000, light: 2000, deep: 20000 },
  maxAngles: { label: 'Angle / vector candidates', help: 'Candidate allowance for each applicable angle or vector resource.', min: 0, max: 1000000, light: 5000, deep: 50000 },
  maxComparisons: { label: 'Comparisons per resource', help: 'Separate allowance for each named comparison resource; not a global total.', min: 0, max: 1000000, light: 50000, deep: 500000 },
  maxModels: { label: 'Generator models', help: 'Maximum models per generator family.', min: 0, max: 12, light: 3, deep: 8 },
  maxRelations: { label: 'Returned relations', help: 'Maximum relations retained in the discovery catalog.', min: 0, max: 1000000, light: 200, deep: 1000 },
} as const;
export const DISCOVERY_BUDGET_KEYS = Object.keys(DISCOVERY_BUDGET_FIELDS) as Array<keyof typeof DISCOVERY_BUDGET_FIELDS>;
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
    for (const key of DISCOVERY_BUDGET_KEYS) {
      const number = options[key];
      if (typeof number === 'number' && Number.isFinite(number)) result.options[key] = Math.round(Math.max(DISCOVERY_BUDGET_FIELDS[key].min, Math.min(DISCOVERY_BUDGET_FIELDS[key].max, number)));
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
