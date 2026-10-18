import { DEFAULT_GGB_PREFERENCES } from './defaults';
import type { GgbPreferences } from './types';

export const GGB_PREFERENCES_KEY = 'geogebra-studio-preferences-v1';

export function normalizePreferences(value: unknown): GgbPreferences {
  const result = { ...DEFAULT_GGB_PREFERENCES };
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(result) as Array<keyof GgbPreferences>) {
    if (typeof result[key] === 'boolean' && typeof source[key] === 'boolean') {
      Object.assign(result, { [key]: source[key] });
    }
  }
  for (const [key, min, max] of [['decimals', 0, 15], ['pointSize', 1, 9], ['lineThickness', 1, 13]] as const) {
    const n = source[key];
    if (typeof n === 'number' && Number.isFinite(n)) result[key] = Math.min(max, Math.max(min, Math.round(n)));
  }
  for (const key of ['pointColor', 'lineColor'] as const) {
    if (typeof source[key] === 'string' && /^#[\da-f]{6}$/i.test(source[key])) result[key] = source[key].toLowerCase();
  }
  if (typeof source.palette === 'string') result.palette = source.palette;
  if (source.stylePolicy === 'override') result.stylePolicy = 'override';
  return result;
}

export function readPreferences(): GgbPreferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(GGB_PREFERENCES_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_GGB_PREFERENCES }; }
}

export function savePreferences(preferences: GgbPreferences): boolean {
  try { localStorage.setItem(GGB_PREFERENCES_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
