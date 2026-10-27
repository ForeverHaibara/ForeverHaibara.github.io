import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ALL_RELATION_KINDS, DEFAULT_RELATION_KINDS, RELATION_GROUPS } from '../relations/catalog';
import { defaultDiscoveryPreferences, normalizeDiscoveryPreferences } from './discoveryPreferences';
import { changeRelationSelection } from './relationSelection';
import { RelationTypeControls } from '../../components/analysis/RelationTypeControls';

describe('global and scoped selection controls', () => {
  it('selects all, clears and inverts without altering types outside the scope', () => {
    expect(changeRelationSelection(['parallel', 'equal-lengths'], ['equal-lengths', 'length-space'], 'all')).toEqual(['parallel', 'equal-lengths', 'length-space']);
    expect(changeRelationSelection(['parallel', 'equal-lengths'], ['equal-lengths', 'length-space'], 'none')).toEqual(['parallel']);
    const inverted = changeRelationSelection(['parallel', 'equal-lengths'], ['equal-lengths', 'length-space'], 'invert');
    expect(inverted).toEqual(['parallel', 'length-space']);
    expect(changeRelationSelection(inverted, ['equal-lengths', 'length-space'], 'invert')).toEqual(['parallel', 'equal-lengths']);
    expect(changeRelationSelection([], ALL_RELATION_KINDS, 'all')).toEqual(ALL_RELATION_KINDS);
    expect(changeRelationSelection(ALL_RELATION_KINDS, ALL_RELATION_KINDS, 'invert')).toEqual([]);
  });
  it('covers the catalog exactly once in categories and renders named controls for each category', () => {
    const all = RELATION_GROUPS.flatMap((group) => group.items.map((item) => item.kind));
    expect(new Set(all).size).toBe(ALL_RELATION_KINDS.length);
    expect(all).toHaveLength(ALL_RELATION_KINDS.length);
    const html = renderToStaticMarkup(<RelationTypeControls kinds={ALL_RELATION_KINDS} purpose="compute" onChange={() => {}} />);
    for (const { label } of RELATION_GROUPS) {
      expect(html).toContain(`aria-label="All compute ${label}"`);
      expect(html).toContain(`aria-label="Invert compute ${label}"`);
    }
    expect(html).toContain('aria-label="All compute types"');
    expect(html).not.toContain('Show:');
    const filters = renderToStaticMarkup(<RelationTypeControls kinds={[]} purpose="filter" onChange={() => {}} />);
    expect(filters).toContain('aria-label="All filter types"');
    expect(filters).not.toContain('disabled');
  });
  it('keeps display-only operations outside compute options', () => {
    const before = defaultDiscoveryPreferences();
    const next = normalizeDiscoveryPreferences({ ...before, visibleKinds: changeRelationSelection(before.visibleKinds, ['equal-lengths'], 'none') });
    expect(next.options).toEqual(before.options);
    expect(next.visibleKinds).not.toContain('equal-lengths');
  });
});

describe('catalog growth migration', () => {
  const oldKinds = ALL_RELATION_KINDS.filter((kind) => !['midpoint', 'length-multiple', 'angle-multiple', 'complementary-angles', 'supplementary-angles', 'length-space'].includes(kind));
  it('adopts new defaults for an old complete selection but leaves optional angle sums off', () => {
    const result = normalizeDiscoveryPreferences({ options: { enabledKinds: oldKinds }, visibleKinds: oldKinds });
    expect(result.options.enabledKinds).toEqual(DEFAULT_RELATION_KINDS);
    expect(result.visibleKinds).toEqual(ALL_RELATION_KINDS);
    expect(result.knownKinds).toEqual(ALL_RELATION_KINDS);
  });
  it('preserves old selective or empty choices', () => {
    expect(normalizeDiscoveryPreferences({ options: { enabledKinds: ['parallel'] } }).options.enabledKinds).toEqual(['parallel']);
    expect(normalizeDiscoveryPreferences({ options: { enabledKinds: [] } }).options.enabledKinds).toEqual([]);
  });
  it('does not re-enable a newly known type after the user turns it off', () => {
    const result = normalizeDiscoveryPreferences({ ...defaultDiscoveryPreferences(), options: { ...defaultDiscoveryPreferences().options, enabledKinds: ['midpoint'] } });
    expect(result.options.enabledKinds).toEqual(['midpoint']);
  });
});
