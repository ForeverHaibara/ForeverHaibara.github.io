import type { GeoGebraEngine } from '../../types';
import type { CompletionProvider } from './types';
import { isInternalHelperName } from '../custom/internalHelpers';

/** Engine-scoped: never register construction data in the shared command catalog. */
export const createObjectCompletionProvider = (engine: GeoGebraEngine): CompletionProvider => ({
  id: 'construction-objects',
  async provide(context, signal) {
    if (context.mode !== 'command' || signal.aborted) return [];
    const raw = await engine.callApi('getAllObjectNames', []);
    if (signal.aborted) return [];
    const names = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').map((name) => name.trim()) : [];
    const matching = names.filter((name): name is string => typeof name === 'string' && name.length > 0 && !isInternalHelperName(name) && name.toLowerCase().startsWith(context.prefix.toLowerCase()));
    const items = [];
    // Bounded batches keep a large construction from issuing thousands of API
    // calls after a keystroke; cancellation is checked before each batch.
    for (let start = 0; start < matching.length && !signal.aborted; start += 24) {
      const batch = await Promise.all(matching.slice(start, start + 24).map(async (label) => {
        const [type, definition] = await Promise.allSettled([
          engine.callApi('getObjectType', [label]),
          engine.callApi('getDefinitionString', [label]),
        ]);
        return {
          label, kind: 'object' as const, callable: false,
          objectType: type.status === 'fulfilled' && typeof type.value === 'string' ? type.value : undefined,
          description: definition.status === 'fulfilled' && typeof definition.value === 'string' ? definition.value : undefined,
        };
      }));
      items.push(...batch);
    }
    return signal.aborted ? [] : items;
  },
  subscribe: (listener) => engine.subscribe((event) => {
    if (['add', 'remove', 'rename', 'clear', 'dragEnd'].includes(event.type)) listener();
  }),
});
