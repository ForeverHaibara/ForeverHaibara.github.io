import { describe, expect, it, vi } from 'vitest';
import { applyCompletion, getCompletionContext } from './completionContext';
import { CompletionRegistry } from './completionRegistry';
import { studioCompletionRegistry } from './studioCompletionRegistry';
import type { CompletionContext, CompletionItem } from './types';

const at = (marked: string, explicit = false): CompletionContext => {
  const cursor = marked.indexOf('|');
  const context = getCompletionContext(marked.replace('|', ''), cursor, cursor, explicit);
  if (!context) throw new Error(`Expected completion context: ${marked}`);
  return context;
};
const circle: CompletionItem = { label: 'Circle', kind: 'command' };
const signal = () => new AbortController().signal;

describe('completion context and text edits', () => {
  it('replaces the whole token at the caret without changing surrounding lines', () => {
    const context = at('A = (0, 0)\nc = ci|rcLE(A, B)\nB = (1, 2)');
    expect(context.prefix).toBe('ci');
    const edit = applyCompletion(context, circle);
    expect(edit.value).toBe('A = (0, 0)\nc = Circle(A, B)\nB = (1, 2)');
    expect(edit.value.slice(0, edit.cursor)).toBe('A = (0, 0)\nc = Circle(');
  });

  it('adds parentheses and leaves the caret inside them', () => {
    expect(applyCompletion(at('c = cI|'), circle)).toEqual({ value: 'c = Circle()', cursor: 11 });
  });

  it.each(['ci| (A, B)', 'ci|[A, B]'])('reuses existing brackets in %s', (marked) => {
    const edit = applyCompletion(at(marked), circle);
    expect(edit.value.match(/Circle/g)).toHaveLength(1);
    expect(edit.value.slice(0, edit.cursor)).toMatch(/^Circle\s*[([]$/);
    expect(edit.value).not.toContain('()');
  });

  it('supports plain symbols, custom insertion text and Unicode command names', () => {
    expect(applyCompletion(at('cu|'), { label: 'Custom', kind: 'custom', insertText: 'Custom(A, B)' })).toEqual({ value: 'Custom(A, B)', cursor: 12 });
    expect(applyCompletion(at('va|'), { label: 'value', kind: 'custom', callable: false }).value).toBe('value');
    expect(at('构造|').prefix).toBe('构造');
  });

  it.each(['"ci', 'Text("ci', '# ci', 'A = 1 // ci', '!setCaption("A", "ci', "!setCaption('A', 'ci"])('does not complete inside literals or comments: %s', (input) => {
    expect(getCompletionContext(input, input.length)).toBeNull();
  });

  it('handles escaped quotes and primes without confusing the token boundary', () => {
    expect(getCompletionContext('Text("a\\"ci', 11)).toBeNull();
    expect(at("A' = ci|").prefix).toBe('ci');
    expect(at('# comment\nci|').prefix).toBe('ci');
  });

  it('distinguishes API method names from API arguments', () => {
    expect(at(' !GeTOb|').mode).toBe('api');
    expect(at('!api getOb|').prefix).toBe('getOb');
    expect(at('!|').mode).toBe('api');
    expect(getCompletionContext('!setColor(ci', 12)).toBeNull();
  });

  it('suppresses assignment labels, numeric tokens and nonempty selections', () => {
    expect(getCompletionContext('ci = 1', 2)).toBeNull();
    expect(getCompletionContext('123', 3)).toBeNull();
    expect(getCompletionContext('Circle', 1, 4)).toBeNull();
    expect(getCompletionContext('', 0)).toBeNull();
    expect(getCompletionContext('', 0, 0, true)?.prefix).toBe('');
  });
});

describe('completion providers and registration', () => {
  it('matches case-insensitively and keeps API and command catalogs separate', async () => {
    const commands = await studioCompletionRegistry.complete(at('cI|'), signal());
    expect(commands.map((item) => item.label)).toEqual(expect.arrayContaining(['Circle', 'CircularSector', 'CircumcircularArc']));
    const api = await studioCompletionRegistry.complete(at('!GETOBJ|'), signal());
    expect(api.map((item) => item.label)).toContain('getObjectType');
    expect(api.every((item) => item.kind === 'api')).toBe(true);
    expect(await studioCompletionRegistry.complete(at('zzzzzz|'), signal())).toEqual([]);
  });

  it('ships a unique offline catalog with optional help for common commands', async () => {
    const items = await studioCompletionRegistry.complete(at('|', true), signal());
    expect(items.length).toBeGreaterThan(400);
    expect(new Set(items.map((item) => item.label.toLowerCase())).size).toBe(items.length);
    expect(items.find((item) => item.label === 'Circle')?.signatures).toContain('Circle(A, B, C)');
  });

  it('registers custom commands, matches aliases, prioritizes overrides and removes them', async () => {
    const registry = new CompletionRegistry();
    registry.registerCommands('builtin', [circle]);
    const custom: CompletionItem = { label: 'Circle', kind: 'custom', priority: 10 };
    const unregister = registry.registerCommands('custom', [custom, { label: 'MyCenter', aliases: ['中心'], kind: 'custom' }]);
    expect(await registry.complete(at('ci|'), signal())).toEqual([custom]);
    expect((await registry.complete(at('中|'), signal()))[0].label).toBe('MyCenter');
    unregister();
    unregister();
    expect(await registry.complete(at('ci|'), signal())).toEqual([circle]);
  });

  it('notifies live editors and rejects duplicate provider IDs', () => {
    const registry = new CompletionRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const unregister = registry.registerCommands('one', [circle]);
    expect(registry.getSnapshot()).toBe(1);
    expect(() => registry.registerCommands('one', [])).toThrow('already registered');
    unregister();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    registry.registerCommands('two', []);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('isolates both synchronous and asynchronous provider failures', async () => {
    const registry = new CompletionRegistry();
    registry.register({ id: 'broken', provide: () => { throw new Error('offline'); } });
    registry.register({ id: 'rejected', provide: () => Promise.reject(new Error('offline')) });
    registry.registerCommands('working', [circle]);
    expect(await registry.complete(at('ci|'), signal())).toEqual([circle]);
  });

  it('keeps a stale disposer from removing a later registration of the same provider', async () => {
    const registry = new CompletionRegistry();
    const provider = { id: 'reusable', provide: () => [circle] };
    const removeOld = registry.register(provider);
    removeOld();
    registry.register(provider);
    removeOld();
    expect(await registry.complete(at('ci|'), signal())).toEqual([circle]);
  });

  it('does not start providers for an already cancelled request', async () => {
    const registry = new CompletionRegistry();
    const provide = vi.fn(() => [circle]);
    registry.register({ id: 'unused', provide });
    const controller = new AbortController();
    controller.abort();
    expect(await registry.complete(at('ci|'), controller.signal)).toEqual([]);
    expect(provide).not.toHaveBeenCalled();
  });

  it('publishes local matches before a slow provider finishes', async () => {
    const registry = new CompletionRegistry();
    let resolve!: (items: CompletionItem[]) => void;
    registry.register({ id: 'slow', provide: () => new Promise((done) => { resolve = done; }) });
    registry.registerCommands('local', [circle]);
    const update = vi.fn();
    const pending = registry.complete(at('ci|'), signal(), update);
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith([circle]));
    resolve([{ label: 'CircularSector', kind: 'custom' }]);
    expect((await pending).map((item) => item.label)).toEqual(['Circle', 'CircularSector']);
  });

  it('discards cancelled requests and ignores later results', async () => {
    const registry = new CompletionRegistry();
    let resolve!: (items: CompletionItem[]) => void;
    registry.register({ id: 'slow', provide: () => new Promise((done) => { resolve = done; }) });
    const controller = new AbortController();
    const update = vi.fn();
    const pending = registry.complete(at('ci|'), controller.signal, update);
    controller.abort();
    resolve([circle]);
    expect(await pending).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });

  it('breaks equal-priority ties by registration order rather than response time', async () => {
    const registry = new CompletionRegistry();
    let resolve!: (items: CompletionItem[]) => void;
    registry.register({ id: 'first-but-slow', provide: () => new Promise((done) => { resolve = done; }) });
    registry.registerCommands('second-but-fast', [{ ...circle, description: 'second' }]);
    const pending = registry.complete(at('ci|'), signal());
    resolve([{ ...circle, description: 'first' }]);
    expect((await pending)[0].description).toBe('first');
  });
});
