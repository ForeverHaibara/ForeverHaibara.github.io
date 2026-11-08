export type CompletionMode = 'command' | 'api';

export interface CompletionContext {
  input: string;
  cursor: number;
  prefix: string;
  range: { start: number; end: number };
  mode: CompletionMode;
  explicit: boolean;
}

export interface CompletionItem {
  label: string;
  kind: 'command' | 'api' | 'custom' | 'object';
  description?: string;
  /** Native command description when the same name also has Studio extensions. */
  nativeDescription?: string;
  /** GeoGebra's concrete type; kept separate from the provider category. */
  objectType?: string;
  signatures?: readonly string[];
  aliases?: readonly string[];
  /** Canonical entry in the Studio tool reference, when this provider owns one. */
  referenceName?: string;
  /** Defaults to the label. Text only: never executed when a completion is accepted. */
  insertText?: string;
  /** Add parentheses and place the caret inside them (default: true). */
  callable?: boolean;
  /** Higher values win when providers supply the same label. */
  priority?: number;
}

export interface CompletionProvider {
  id: string;
  provide(context: CompletionContext, signal: AbortSignal): readonly CompletionItem[] | Promise<readonly CompletionItem[]>;
  subscribe?(listener: () => void): () => void;
}

export interface CompletionEdit {
  value: string;
  cursor: number;
}
