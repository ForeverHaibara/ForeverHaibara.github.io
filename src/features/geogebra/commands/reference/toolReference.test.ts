import { describe, expect, it } from 'vitest';
import { AdvancedCommandRegistry, advancedCommands } from '../advancedCommands';
import { resolveToolAliases, studioToolCatalog } from '../custom/toolLibrary';
import { toolGroups } from './toolCategories';
import { findReferenceTool, getReferenceTools, searchReferenceTools, specialGroup, visitToolCategories } from './toolReference';

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
    const canonicalNames = new Set(studioToolCatalog.tools.map(({ name }) => name));
    const duplicates: string[] = [];
    const classified = new Set<string>();
    const seenByGroup = new Map<string, Set<string>>();
    visitToolCategories(toolGroups, (path, group) => {
      const seen = seenByGroup.get(path[0]) ?? new Set<string>();
      seenByGroup.set(path[0], seen);
      for (const name of group) {
        if (seen.has(name)) duplicates.push(`${path.join(' / ')}: ${name}`);
        seen.add(name);
        classified.add(name);
        expect(canonicalNames.has(name), `Unknown canonical tool "${name}" in category "${path.join(' / ')}"`).toBe(true);
      }
    });
    expect(duplicates, 'Duplicate tools within categories').toEqual([]);
    expect([...canonicalNames].filter((name) => !classified.has(name)), 'Unclassified tools').toEqual([]);
    for (const tool of tools) {
      for (const related of tool.notes?.related ?? []) {
        expect(names.has(related), `Unknown related tool "${related}" in ${tool.name}`).toBe(true);
      }
    }
  });

  it('finds aliases, terminology, cross-listed cubics and numbered tools', () => {
    expect(findReferenceTool(tools, 'southpole')?.name).toBe('ArcMidpoint');
    expect(searchReferenceTools(tools, 'SouthPole', '')[0]).toMatchObject({ alias: 'SouthPole', tool: { name: 'ArcMidpoint' } });
    expect(searchReferenceTools(tools, '垂足', '').map(({ tool }) => tool.name)).toContain('PedalTriangle');
    for (const category of ['Cubics', 'Quadrangle or quadrilateral geometry']) {
      expect(searchReferenceTools(tools, '', category).map(({ tool }) => tool.name)).toContain('QACu1');
    }
    expect(searchReferenceTools(tools, 'Q036A', '')[0]?.tool.name).toBe('GibertCurve');
    expect(searchReferenceTools(tools, 'X(2)', '')[0]?.tool.name).toBe('TriangleCenter');
    expect(findReferenceTool(tools, 'PedalCircle')?.paths).toContainEqual(['Triangle constructions', 'Circles', 'Circles from a point']);
    expect(searchReferenceTools(tools, 'circles from a point', '').map(({ tool }) => tool.name)).toContain('PedalCircle');
    expect(findReferenceTool(tools, 'SouthPole')?.notes?.keywords).toContain('弧中点');
    expect(findReferenceTool(tools, '!nearestTriangleCenter')?.notes?.examples?.[0]?.command).toBe('!nearestTriangleCenter(A, B, C, P)');
  });

  it('validates reference metadata for both command registries', () => {
    const tool = studioToolCatalog.tools[0];
    const library = { ...studioToolCatalog, tools: [{ ...tool, reference: { examples: [{ command: '' }] } }] };
    expect(() => resolveToolAliases(library)).toThrow(`Invalid reference metadata: ${tool.name}`);
    const registry = new AdvancedCommandRegistry();
    const command = advancedCommands.list()[0];
    expect(() => registry.register({ ...command, reference: { related: [''] } })).toThrow(`Invalid reference metadata: !${command.name}`);
  });
});
