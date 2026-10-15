import type { GeoGebraEngine } from '../../types';
import { readFileTools } from '../custom/commandEnvironment';
import type { CompletionProvider } from './types';

export const createFileToolCompletionProvider = (engine: GeoGebraEngine): CompletionProvider => ({
  id: 'file-tools',
  async provide(context, signal) {
    if (context.mode !== 'command' || signal.aborted) return [];
    const tools = await readFileTools(engine);
    if (signal.aborted) return [];
    return tools.map((tool) => ({ label: tool.name, kind: 'custom' as const, description: 'Tool defined in the current GeoGebra file', signatures: [tool.signature], priority: 100 }));
  },
  subscribe: (listener) => engine.subscribe((event) => { if (event.type === 'clear' || event.type === 'toolsChanged') listener(); }),
});
