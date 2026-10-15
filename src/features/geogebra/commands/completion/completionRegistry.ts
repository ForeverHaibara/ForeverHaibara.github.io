import type { CompletionContext, CompletionItem, CompletionMode, CompletionProvider } from './types';

export const completionItemKey = (item: CompletionItem): string => item.kind === 'object' ? `object:${item.label}` : `command:${item.label.toLowerCase()}`;

/** Framework-independent provider registry. A failing provider cannot disable other sources. */
export class CompletionRegistry {
  private providers = new Map<string, CompletionProvider>();
  private listeners = new Set<() => void>();
  private version = 0;

  getSnapshot = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  register(provider: CompletionProvider): () => void {
    if (this.providers.has(provider.id)) throw new Error(`Completion provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
    this.notify();
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.providers.get(provider.id) !== provider) return;
      this.providers.delete(provider.id);
      this.notify();
    };
  }

  registerCommands(id: string, items: readonly CompletionItem[], mode: CompletionMode = 'command'): () => void {
    return this.register({ id, provide: (context) => context.mode === mode ? items : [] });
  }

  async complete(context: CompletionContext, signal: AbortSignal, onUpdate?: (items: CompletionItem[]) => void, localProviders: readonly CompletionProvider[] = []): Promise<CompletionItem[]> {
    if (signal.aborted) return [];
    const batches: Array<readonly CompletionItem[]> = [];
    await Promise.allSettled([...this.providers.values(), ...localProviders].map(async (provider, index) => {
      const items = await provider.provide(context, signal);
      if (signal.aborted) return;
      batches[index] = items;
      onUpdate?.(this.match(batches.flat(), context.prefix));
    }));
    return signal.aborted ? [] : this.match(batches.flat(), context.prefix);
  }

  private match(items: readonly CompletionItem[], query: string): CompletionItem[] {
    const prefix = query.toLowerCase();
    const byLabel = new Map<string, CompletionItem>();
    for (const item of items) {
      if (![item.label, ...(item.aliases ?? [])].some((label) => label.toLowerCase().startsWith(prefix))) continue;
      const key = completionItemKey(item);
      const existing = byLabel.get(key);
      if (!existing || (item.priority ?? 0) > (existing.priority ?? 0)) byLabel.set(key, item);
    }
    const rank = (item: CompletionItem): number => item.label.toLowerCase() === prefix ? 0 : item.label.toLowerCase().startsWith(prefix) ? 1 : 2;
    return [...byLabel.values()].sort((left, right) => {
      if (left.kind === 'object' || right.kind === 'object') {
        if (left.kind !== right.kind) return left.kind === 'object' ? -1 : 1;
        const caseMatch = Number(right.label.startsWith(query)) - Number(left.label.startsWith(query));
        if (caseMatch) return caseMatch;
      }
      return rank(left) - rank(right) || (right.priority ?? 0) - (left.priority ?? 0) || left.label.localeCompare(right.label, 'en');
    });
  }

  private notify(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}
