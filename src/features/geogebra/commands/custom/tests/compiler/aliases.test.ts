import { describe, expect, it } from 'vitest';
import { compileStudioCommand, containsStudioCall } from '../../commandCompiler';
import { resolveToolAliases, studioToolCatalog, studioToolLibrary, studioTools } from '../../toolLibrary';
import { studioCompletionRegistry } from '../../../completion/studioCompletionRegistry';
import { getCompletionContext } from '../../../completion/completionContext';
import type { CommandEnvironment, ToolDefinition, ToolLibrary } from '../../types';

const fixture = (): ToolLibrary => ({
  schemaVersion: 1, id: 'test.aliases', version: '0.1.0', tools: [{
    name: 'Echo', aliases: ['EchoPoint', 'EchoValue'], description: 'Return the argument.',
    overloads: [
      { params: [{ name: 'P', type: 'point' }], returns: 'point', expression: '$P' },
      { params: [{ name: 'n', type: 'number' }], returns: 'number', expression: '$n' },
    ],
  }],
});
const scope = (): CommandEnvironment => ({ objects: new Map([['P', 'point'], ['q', 'conic']]), macros: new Set() });

describe('canonical tool aliases', () => {
  it('keeps only canonical source definitions while exposing all existing callable names', () => {
    expect(studioToolCatalog.version).toBe('0.2.0');
    for (const [name, canonical] of [['SouthPole', 'ArcMidpoint'], ['NorthPole', 'OppositeArcMidpoint']]) {
      expect(studioToolCatalog.tools.some((tool) => tool.name === name)).toBe(false);
      const original = studioToolCatalog.tools.find((tool) => tool.name === canonical)!;
      const alias = studioTools.get(name.toLowerCase())!;
      expect(original.aliases).toContain(name);
      expect(alias.description).toBe(original.description);
      expect(alias.overloads).toBe(studioTools.get(canonical.toLowerCase())!.overloads);
      expect(alias.canonicalName).toBe(canonical);
      expect(containsStudioCall(`${name}(A,B,C)`)).toBe(true);
      const environment: CommandEnvironment = { objects: new Map(['A', 'B', 'C'].map((v) => [v, 'point'])), macros: new Set() };
      expect(compileStudioCommand(`${name}(A,B,C)`, environment)).toBe(compileStudioCommand(`${canonical}(A,B,C)`, environment));
    }
    const aliasCount = studioToolCatalog.tools.reduce((count, tool) => count + (tool.aliases?.length ?? 0), 0);
    expect(studioToolLibrary.tools).toHaveLength(studioToolCatalog.tools.length + aliasCount);
  });

  it('supports multiple aliases sharing all overloads without changing the editable catalog', () => {
    const catalog = fixture(); const before = structuredClone(catalog);
    const resolved = resolveToolAliases(catalog);
    expect(catalog).toEqual(before);
    expect(resolved.tools.map((tool) => tool.name)).toEqual(['Echo', 'EchoPoint', 'EchoValue']);
    const tools = new Map(resolved.tools.map((tool) => [tool.name.toLowerCase(), tool]));
    for (const tool of resolved.tools) {
      expect(tool.overloads).toBe(catalog.tools[0].overloads);
      expect(tool.description).toBe(catalog.tools[0].description);
      expect(compileStudioCommand(`${tool.name}(P)`, scope(), tools)).toBe('(P)');
      expect(compileStudioCommand(`${tool.name}(2)`, scope(), tools)).toBe('(2)');
    }
    expect(compileStudioCommand('echopoint(P)', scope(), tools)).toBe('(P)');
    expect(() => compileStudioCommand('EchoPoint(q)', scope(), tools)).toThrow('No overload for EchoPoint');
    expect(compileStudioCommand('EchoValue(EchoPoint(P))', scope(), tools)).toBe('((P))');
  });

  it('rejects invalid, duplicate, self and canonical-name collisions case-insensitively', () => {
    for (const aliases of [null, 'Alias', [''], ['bad-name'], [null], ['Echo'], ['eCHO'], ['Alias', 'ALIAS'], [{ name: 'Alias' }]]) {
      const catalog = fixture(); Object.assign(catalog.tools[0], { aliases });
      expect(() => resolveToolAliases(catalog), JSON.stringify(aliases)).toThrow();
    }
    for (const reverse of [false, true]) {
      const catalog = fixture();
      catalog.tools.push({ name: 'echoPOINT', description: 'Collision.', overloads: catalog.tools[0].overloads });
      if (reverse) catalog.tools.reverse();
      expect(() => resolveToolAliases(catalog)).toThrow('duplicate');
    }
    const catalog = fixture();
    catalog.tools.push({ ...catalog.tools[0], name: 'Other' });
    expect(() => resolveToolAliases(catalog)).toThrow('duplicate');
  });

  it('preserves independent outputs and detects composition cycles through an alias', () => {
    const catalog = fixture();
    catalog.tools[0].overloads = [{ params: [{ name: 'P', type: 'point' }], returns: 'point', compose: ['$P', '$P+(1,0)'] }];
    let tools: ReadonlyMap<string, ToolDefinition> = new Map(resolveToolAliases(catalog).tools.map((t) => [t.name.toLowerCase(), t]));
    expect(compileStudioCommand('R=EchoPoint(P)', scope(), tools).split('\n')).toHaveLength(2);
    expect(compileStudioCommand('Line(EchoValue(P),P)', scope(), tools)).not.toContain('\n');
    catalog.tools[0].overloads[0].compose = 'EchoPoint($P)';
    tools = new Map(resolveToolAliases(catalog).tools.map((t) => [t.name.toLowerCase(), t]));
    expect(() => compileStudioCommand('Echo(P)', scope(), tools)).toThrow('Cyclic tool composition');
  });

  it('lets a file macro own an alias without overriding its canonical entry or internal dependencies', () => {
    const environment: CommandEnvironment = { objects: new Map(['A', 'B', 'C'].map((v) => [v, 'point'])), macros: new Set(['southpole']) };
    expect(compileStudioCommand('SouthPole(A,B,C)', environment)).toBe('SouthPole(A,B,C)');
    expect(compileStudioCommand('ArcMidpoint(A,B,C)', environment)).toContain('ConjugateDiameter');
    const catalog = fixture();
    catalog.tools.push({ name: 'ViaAlias', description: 'A dependency.', overloads: [{ params: [{ name: 'P', type: 'point' }], returns: 'point', compose: 'EchoPoint($P)' }] });
    const tools = new Map(resolveToolAliases(catalog).tools.map((t) => [t.name.toLowerCase(), t]));
    const user = scope(); user.macros.add('echopoint');
    expect(compileStudioCommand('EchoPoint(P)', user, tools)).toBe('EchoPoint(P)');
    expect(compileStudioCommand('ViaAlias(P)', user, tools)).not.toContain('EchoPoint');
  });

  it('registers aliases with the same description and renamed signatures in completion', async () => {
    const items = await studioCompletionRegistry.complete(getCompletionContext('', 0, 0, true)!, new AbortController().signal);
    const canonical = items.find((item) => item.label === 'ArcMidpoint')!;
    const alias = items.find((item) => item.label === 'SouthPole')!;
    expect(alias.kind).toBe('custom');
    expect(alias.description).toBe(canonical.description);
    expect(alias.signatures).toEqual(canonical.signatures!.map((signature) => signature.replace('ArcMidpoint', 'SouthPole')));
  });
});
