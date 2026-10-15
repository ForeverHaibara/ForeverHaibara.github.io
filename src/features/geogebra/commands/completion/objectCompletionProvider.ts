import type { GeoGebraEngine } from '../../types';
import type { CompletionProvider } from './types';

/** Engine-scoped: never register construction data in the shared command catalog. */
export const createObjectCompletionProvider = (engine: GeoGebraEngine): CompletionProvider => ({
  id: 'construction-objects',
  async provide(context, signal) {
    if (context.mode !== 'command' || signal.aborted) return [];
    const raw = await engine.callApi('getAllObjectNames', []);
    if (signal.aborted) return [];
    const names = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',').map((name) => name.trim()) : [];
    return names.filter((name): name is string => typeof name === 'string' && name.length > 0).map((label) => ({
      label, kind: 'object' as const, callable: false, description: 'Existing construction object',
    }));
  },
  subscribe: (listener) => engine.subscribe((event) => {
    if (event.type === 'add' || event.type === 'remove' || event.type === 'clear') listener();
  }),
});
