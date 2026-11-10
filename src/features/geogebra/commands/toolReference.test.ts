import { describe, expect, it } from 'vitest';
import { AdvancedCommandRegistry, advancedCommands } from './advancedCommands';
import { resolveToolAliases, studioToolCatalog } from './custom/toolLibrary';
import { toolGroups } from './custom/toolCategories';
import { findReferenceTool, getReferenceTools, nativeCommandReference, searchReferenceTools, specialGroup, visitToolCategories } from './toolReference';
import { GEOGEBRA_COMMAND_NAMES } from './completion/geogebraCommandNames';
import { studioCompletionRegistry } from './completion/studioCompletionRegistry';
import { getCompletionContext } from './completion/completionContext';
import { compileStudioCommand } from './custom/commandCompiler';

const tools = getReferenceTools(studioToolCatalog, advancedCommands.list());

describe('Studio tool reference', () => {
  it('uses canonical construction entries and derives special command syntax from the registry', () => {
    const special = advancedCommands.list();
    const nativeOnly = Object.keys(nativeCommandReference).filter((name) => !studioToolCatalog.tools.some((tool) => tool.name.toLowerCase() === name.toLowerCase()));
    expect(tools).toHaveLength(studioToolCatalog.tools.length + nativeOnly.length + special.length);
    for (const { name, signatures } of special) {
      const entry = findReferenceTool(tools, `!${name}`);
      expect(entry?.groups).toEqual([specialGroup]);
      expect(entry?.signatures.map(({ text }) => text)).toEqual(signatures.map((text) => `!${text}`));
    }
  });

  it('keeps classifications and supplemental notes attached to real canonical entries', () => {
    const names = new Set(tools.map(({ name }) => name));
    const canonicalNames = new Set([...studioToolCatalog.tools.map(({ name }) => name), ...Object.keys(nativeCommandReference)]);
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

  it('merges documented native forms with extensions while preserving dispatch and completion', async () => {
    for (const [name, native] of Object.entries(nativeCommandReference)) {
      expect(GEOGEBRA_COMMAND_NAMES, name).toContain(name);
      expect(tools.filter((tool) => tool.name === name)).toHaveLength(1);
      const tool = findReferenceTool(tools, name)!;
      for (const signature of native.signatures.filter((item) => item.shared)) {
        expect(tool.signatures.map((item) => item.text), name).toContain(signature.text);
      }
    }
    const incircle = findReferenceTool(tools, 'Incircle')!;
    expect(incircle.paths).toContainEqual(['Triangle constructions', 'Circles', 'Circles of the triangle']);
    expect(incircle.native?.signatures[0].text).toBe('Incircle(A: point, B: point, C: point)');
    expect(searchReferenceTools(tools, '内切圆', '').map(({ tool }) => tool.name)).toContain('Incircle');
    expect(findReferenceTool(tools, 'Conic')?.native?.signatures.map(({ text }) => text)).toContain('Conic(coefficients: list)');
    expect(findReferenceTool(tools, 'Intersect')?.signatures.map(({ text }) => text)).toContain('Intersect(A: point, B: point, C: point, D: point)');
    const scope = { objects: new Map([['A', 'point' as const], ['B', 'point' as const], ['C', 'point' as const], ['D', 'point' as const]]), macros: new Set<string>() };
    expect(compileStudioCommand('Incircle(A,B,C)', scope)).toBe('Incircle(A,B,C)');
    expect(compileStudioCommand('Conic(1,2,3,4,5,6)', scope)).toBe('Conic(1,2,3,4,5,6)');
    expect(compileStudioCommand('Intersect(A,B,C,D)', scope)).toBe('Intersect(Line((A),(B)),Line((C),(D)))');
    const complete = async (query: string) => studioCompletionRegistry.complete(getCompletionContext(query, query.length, query.length, true)!, new AbortController().signal);
    const nativeCompletion = (await complete('Incircle')).find((item) => item.label === 'Incircle')!;
    expect(nativeCompletion.referenceName).toBe('Incircle');
    expect(nativeCompletion.description).toBe(nativeCommandReference.Incircle.description);
    expect(nativeCompletion.nativeDescription).toBeUndefined();
    expect(nativeCompletion.signatures).toContain('Incircle(A: point, B: point, C: point)');
    const mixedCompletion = (await complete('Conic')).find((item) => item.label === 'Conic')!;
    expect(mixedCompletion.referenceName).toBe('Conic');
    expect(mixedCompletion.description).toBe(findReferenceTool(tools, 'Conic')?.description);
    expect(mixedCompletion.nativeDescription).toBe(nativeCommandReference.Conic.description);
    expect(mixedCompletion.signatures).toContain('Conic(coefficients: list)');
    expect(mixedCompletion.signatures?.filter((signature) => signature === 'Conic(A: point, B: point, C: point, D: point, E: point)')).toHaveLength(1);
    expect(searchReferenceTools(tools, 'polygon', '').map(({ tool }) => tool.name)).toContain('Centroid');
    expect(findReferenceTool(tools, 'Polygon')?.paths).toContainEqual(['Quadri or poly geometry', 'Polygons']);
    expect(findReferenceTool(tools, 'Ellipse')?.paths).toContainEqual(['Circles and conics', 'General constructions']);
    const polygonCompletion = (await complete('Polygon')).find((item) => item.label === 'Polygon')!;
    expect(polygonCompletion.referenceName).toBe('Polygon');
    expect(polygonCompletion.signatures).toContain('Polygon(points: list)');
  });

  it('finds aliases, terminology, cross-listed cubics and numbered tools', () => {
    expect(findReferenceTool(tools, 'southpole')?.name).toBe('ArcMidpoint');
    expect(searchReferenceTools(tools, 'SouthPole', '')[0]).toMatchObject({ alias: 'SouthPole', tool: { name: 'ArcMidpoint' } });
    expect(searchReferenceTools(tools, '垂足', '').map(({ tool }) => tool.name)).toContain('PedalTriangle');
    for (const category of ['Cubics', 'Quadri or poly geometry']) {
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
