import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultDiscoveryPreferences, DISCOVERY_PREFERENCES_KEY, normalizeDiscoveryPreferences, readDiscoveryPreferences, saveDiscoveryPreferences } from './discoveryPreferences';
import { displayScore, scoreColors } from '../presentation/formatRelation';

afterEach(() => vi.unstubAllGlobals());
describe('discovery options remain separate from engine style preferences', () => {
  it('preserves a deliberately empty compute set and ignores unknown types', () => {
    const preferences = normalizeDiscoveryPreferences({ options: { enabledKinds: [] }, visibleKinds: ['equal-angles', 'unknown'] });
    expect(preferences.options.enabledKinds).toEqual([]);
    expect(preferences.visibleKinds).toEqual(['equal-angles']);
  });
  it('bounds integer budgets and does not accept nonfinite limits', () => {
    const preferences = normalizeDiscoveryPreferences({ minimumValue: 123, options: { maxModels: 99999, maxAngles: Infinity, maxTriangles: -3 } });
    expect(preferences.minimumValue).toBe(100);
    expect(preferences.options.maxModels).toBe(12);
    expect(preferences.options.maxTriangles).toBe(0);
    expect(preferences.options.maxAngles).toBe(defaultDiscoveryPreferences().options.maxAngles);
  });
  it('round-trips options using only the discovery storage key', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const preferences = defaultDiscoveryPreferences(); preferences.automatic = false;
    expect(saveDiscoveryPreferences(preferences)).toBe(true);
    expect(readDiscoveryPreferences()).toEqual(preferences);
    expect([...values.keys()]).toEqual([DISCOVERY_PREFERENCES_KEY]);
  });
  it('keeps discovery usable when storage is blocked or corrupt', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad', setItem: () => { throw new Error('blocked'); } });
    expect(readDiscoveryPreferences()).toEqual(defaultDiscoveryPreferences());
    expect(saveDiscoveryPreferences(defaultDiscoveryPreferences())).toBe(false);
  });
});
describe('score palette', () => {
  it('uses the displayed value for color boundaries, independent of relation type', () => {
    expect(displayScore(19.6)).toBe(20);
    expect(scoreColors(19.6)).toEqual(scoreColors(20));
    expect(scoreColors(10)).not.toEqual(scoreColors(90));
    expect(displayScore(120)).toBe(100);
  });
});
