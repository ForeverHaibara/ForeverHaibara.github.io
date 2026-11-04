import { describe, expect, it, vi } from 'vitest';
import type { GeoGebraEngine } from '../types';
import { AdvancedCommandRegistry } from './advancedCommands';

describe('advanced command registry', () => {
  it('dispatches registered commands and passes other names to the engine', async () => {
    const registry = new AdvancedCommandRegistry();
    const callApi = vi.fn().mockResolvedValue('api result');
    const engine = { callApi } as unknown as GeoGebraEngine;
    const execute = vi.fn().mockResolvedValue(42);
    registry.register({ name: 'example', description: 'Example', signatures: ['example(A)'], execute });
    expect(await registry.execute(engine, '!Example(A)')).toBe(42);
    expect(execute).toHaveBeenCalledWith(engine, ['A']);
    expect(await registry.execute(engine, '!getValue("A")')).toBe('api result');
    expect(callApi).toHaveBeenCalledWith('getValue', ['A']);
    expect(() => registry.register({ name: 'EXAMPLE', description: '', signatures: [], execute })).toThrow();
  });
});
