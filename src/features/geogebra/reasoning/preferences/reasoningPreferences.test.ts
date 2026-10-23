import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeReasoningPreferences, readReasoningPreferences, REASONING_FIELDS, REASONING_FIELD_KEYS, REASONING_PREFERENCES_KEY, reasoningPreset, saveReasoningPreferences } from './reasoningPreferences';

afterEach(() => vi.unstubAllGlobals());
describe('reasoning computation preferences', () => {
  it('migrates partial settings with current defaults and ignores invalid or unknown fields', () => {
    expect(normalizeReasoningPreferences({ solvingSeconds: 7, maxVectorRounds: NaN, maxObjects: '20', validateSamples: false, unknown: 5 }))
      .toEqual({ ...reasoningPreset(), solvingSeconds: 7, validateSamples: false });
    expect(normalizeReasoningPreferences(null)).toEqual(reasoningPreset());
  });
  it('bounds every numeric field and keeps zero local discovery budgets meaningful', () => {
    for (const key of REASONING_FIELD_KEYS) {
      expect(normalizeReasoningPreferences({ [key]: -1 })[key]).toBe(REASONING_FIELDS[key].min);
      expect(normalizeReasoningPreferences({ [key]: Number.MAX_VALUE })[key]).toBe(REASONING_FIELDS[key].max);
      expect(normalizeReasoningPreferences({ [key]: Infinity })[key]).toBe(REASONING_FIELDS[key].default);
    }
    expect(normalizeReasoningPreferences({ localMaxTriangles: 0 }).localMaxTriangles).toBe(0);
    expect(normalizeReasoningPreferences({ solvingSeconds: 4.6 }).solvingSeconds).toBe(5);
  });
  it('provides valid presets with monotonically increasing budgets', () => {
    for (const preset of ['light', 'standard', 'deep'] as const) expect(normalizeReasoningPreferences(reasoningPreset(preset))).toEqual(reasoningPreset(preset));
    for (const key of REASONING_FIELD_KEYS) {
      expect(reasoningPreset('light')[key]).toBeLessThanOrEqual(reasoningPreset()[key]);
      expect(reasoningPreset()[key]).toBeLessThanOrEqual(reasoningPreset('deep')[key]);
    }
  });
  it('round-trips separately from construction and visual preferences', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const value = { ...reasoningPreset('deep'), validateSamples: false };
    expect(saveReasoningPreferences(value)).toBe(true); expect(readReasoningPreferences()).toEqual(value);
    expect([...storage.keys()]).toEqual([REASONING_PREFERENCES_KEY]);
  });
  it('falls back safely when stored JSON is corrupt or browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: () => { throw new Error('blocked'); } });
    expect(readReasoningPreferences()).toEqual(reasoningPreset()); expect(saveReasoningPreferences(reasoningPreset())).toBe(false);
  });
});
