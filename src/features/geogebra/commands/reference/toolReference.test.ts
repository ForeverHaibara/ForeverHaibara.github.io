import { describe, expect, it } from 'vitest';
import { advancedCommands } from '../advancedCommands';
import { studioToolCatalog } from '../custom/toolLibrary';
import { referenceNotes, toolGroups } from './referenceNotes';
import { findReferenceTool, getReferenceTools, searchReferenceTools, specialGroup } from './toolReference';

const tools = getReferenceTools();

describe('Studio tool reference', () => {
  it('uses canonical construction entries and derives special command syntax from the registry', () => {
    const special = advancedCommands.list();
    expect(tools).toHaveLength(studioToolCatalog.tools.length + special.length);
    for (const { name, signatures } of special) {
      const entry = findReferenceTool(tools, `!${name}`);
      expect(entry?.groups).toEqual([specialGroup]);
      expect(entry?.signatures.map(({ text }) => text)).toEqual(signatures.map((text) => `!${text}`));
    }
  });

  it('keeps classifications and supplemental notes attached to real canonical entries', () => {
    const names = new Set(tools.map(({ name }) => name));
    const duplicates: string[] = [];
    for (const [category, group] of Object.entries(toolGroups)) {
      const seen = new Set<string>();
      for (const name of group) {
        if (seen.has(name)) duplicates.push(`${category}: ${name}`);
        seen.add(name);
        expect(names.has(name), `Unknown tool "${name}" in category "${category}"`).toBe(true);
      }
    }
    expect(duplicates, 'Duplicate tools within categories').toEqual([]);
    for (const [name, note] of Object.entries(referenceNotes)) {
      expect(names.has(name), name).toBe(true);
      for (const related of note?.related ?? []) expect(names.has(related), related).toBe(true);
    }
  });

  it('finds aliases, terminology, cross-listed cubics and numbered tools', () => {
    expect(findReferenceTool(tools, 'southpole')?.name).toBe('ArcMidpoint');
    expect(searchReferenceTools(tools, 'SouthPole', '')[0]).toMatchObject({ alias: 'SouthPole', tool: { name: 'ArcMidpoint' } });
    expect(searchReferenceTools(tools, '垂足', '').map(({ tool }) => tool.name)).toContain('PedalTriangle');
    for (const category of ['Cubics', 'Quadrilateral or quadrangle geometry']) {
      expect(searchReferenceTools(tools, '', category).map(({ tool }) => tool.name)).toContain('QACu1');
    }
    expect(searchReferenceTools(tools, 'Q036A', '')[0]?.tool.name).toBe('GibertCurve');
    expect(searchReferenceTools(tools, 'X(2)', '')[0]?.tool.name).toBe('TriangleCenter');
  });
});
