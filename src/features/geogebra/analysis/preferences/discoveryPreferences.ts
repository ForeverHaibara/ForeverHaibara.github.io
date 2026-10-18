import { ALL_RELATION_KINDS, DEFAULT_DISCOVERY_OPTIONS } from '../relations/catalog';
import type { DiscoveryOptions, GeometryRelationKind } from '../relations/catalog';

export interface DiscoveryPreferences {
  automatic: boolean;
  options: DiscoveryOptions;
  visibleKinds: GeometryRelationKind[];
  minimumValue: number;
}
export const DISCOVERY_PREFERENCES_KEY = 'geogebra-discovery-preferences-v1';
export const defaultDiscoveryPreferences = (): DiscoveryPreferences => ({ automatic: true,
  options: { ...DEFAULT_DISCOVERY_OPTIONS, enabledKinds: [...ALL_RELATION_KINDS] }, visibleKinds: [...ALL_RELATION_KINDS], minimumValue: 0 });

export const normalizeDiscoveryPreferences = (value: unknown): DiscoveryPreferences => {
  const result = defaultDiscoveryPreferences();
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  const kinds = (input: unknown, fallback: readonly GeometryRelationKind[]) => Array.isArray(input)
    ? ALL_RELATION_KINDS.filter((kind) => input.includes(kind)) : [...fallback];
  if (typeof source.automatic === 'boolean') result.automatic = source.automatic;
  result.visibleKinds = kinds(source.visibleKinds, result.visibleKinds);
  if (typeof source.minimumValue === 'number' && Number.isFinite(source.minimumValue)) result.minimumValue = Math.round(Math.max(0, Math.min(100, source.minimumValue)));
  if (source.options && typeof source.options === 'object') {
    const options = source.options as Record<string, unknown>;
    result.options.enabledKinds = kinds(options.enabledKinds, result.options.enabledKinds);
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
