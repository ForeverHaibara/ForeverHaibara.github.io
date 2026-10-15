import { describe, expect, it, vi } from 'vitest';
import type { EngineEventListener, GeoGebraEngine } from '../../types';
import { applyCompletion, getCompletionContext } from './completionContext';
import { CompletionRegistry } from './completionRegistry';
import { createObjectCompletionProvider } from './objectCompletionProvider';
import type { CompletionItem } from './types';

const context = (prefix: string) => getCompletionContext(prefix, prefix.length, prefix.length, true)!;
const signal = () => new AbortController().signal;
const object = (label: string): CompletionItem => ({ label, kind: 'object', callable: false });

describe('construction object completion', () => {
  it('puts objects before exact command matches and prefers case-sensitive object prefixes', async () => {
    const registry = new CompletionRegistry();
    registry.registerCommands('commands', [{ label: 'Angle', kind: 'command' }, { label: 'A', kind: 'custom', priority: 100 }]);
    const local = { id: 'objects', provide: () => [object('A'), object('a'), object('Angle1'), object('angle2')] };
    const upper = await registry.complete(context('A'), signal(), undefined, [local]);
    expect(upper.map((item) => item.label)).toEqual(['A', 'Angle1', 'a', 'angle2', 'A', 'Angle']);
    const lower = await registry.complete(context('a'), signal(), undefined, [local]);
    expect(lower.slice(0, 4).map((item) => item.label)).toEqual(['a', 'angle2', 'A', 'Angle1']);
    const exactCommand = await registry.complete(context('Angle'), signal(), undefined, [local]);
    expect(exactCommand[0].label).toBe('Angle1');
    expect(applyCompletion(context('A'), upper[0]).value).toBe('A');
  });

  it('keeps case-distinct objects and an identically named command as separate suggestions', async () => {
    const registry = new CompletionRegistry();
    registry.registerCommands('one', [object('Circle'), object('circle'), { label: 'Circle', kind: 'command' }]);
    const items = await registry.complete(context('cir'), signal());
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.kind)).toEqual(['object', 'object', 'command']);
  });

  it('reads current engine names, supports array and string results, and never inserts parentheses', async () => {
    const callApi = vi.fn().mockResolvedValueOnce(['A', 'A_1', '', null]).mockResolvedValueOnce('B, C');
    const provider = createObjectCompletionProvider({ callApi } as unknown as GeoGebraEngine);
    const first = await provider.provide(context('A'), signal());
    expect(first.map((item) => item.label)).toEqual(['A', 'A_1']);
    expect(first.every((item) => item.callable === false && item.kind === 'object')).toBe(true);
    expect((await provider.provide(context('B'), signal())).map((item) => item.label)).toEqual(['B', 'C']);
    expect(callApi).toHaveBeenCalledWith('getAllObjectNames', []);
  });

  it('ignores API contexts and does not leak data between engine-scoped providers', async () => {
    const one = createObjectCompletionProvider({ callApi: vi.fn().mockResolvedValue(['A']) } as unknown as GeoGebraEngine);
    const callTwo = vi.fn().mockResolvedValue(['B']);
    const two = createObjectCompletionProvider({ callApi: callTwo } as unknown as GeoGebraEngine);
    const registry = new CompletionRegistry();
    expect((await registry.complete(context(''), signal(), undefined, [one])).map((item) => item.label)).toEqual(['A']);
    expect((await registry.complete(context(''), signal(), undefined, [two])).map((item) => item.label)).toEqual(['B']);
    callTwo.mockClear();
    expect(await two.provide(context('!get'), signal())).toEqual([]);
    expect(callTwo).not.toHaveBeenCalled();
  });

  it('refreshes on object addition, removal and clearing without reacting to every drag update', () => {
    let listener!: EngineEventListener;
    const unsubscribe = vi.fn();
    const provider = createObjectCompletionProvider({ subscribe: (callback: EngineEventListener) => { listener = callback; return unsubscribe; } } as unknown as GeoGebraEngine);
    const update = vi.fn();
    const dispose = provider.subscribe!(update);
    for (const type of ['add', 'remove', 'clear', 'update', 'dragStart', 'dragEnd'] as const) listener({ type, timestamp: 0 });
    expect(update).toHaveBeenCalledTimes(3);
    dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
