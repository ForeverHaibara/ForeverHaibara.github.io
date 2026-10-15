import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { applyCompletion, getCompletionContext } from './completionContext';
import { completionItemKey, type CompletionRegistry } from './completionRegistry';
import type { CompletionContext, CompletionItem, CompletionProvider } from './types';

const NO_PROVIDERS: readonly CompletionProvider[] = [];

interface CompletionState {
  context: CompletionContext;
  items: CompletionItem[];
  activeIndex: number;
}

interface CommandCompletionOptions {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  registry: CompletionRegistry;
  enabled: boolean;
  providers?: readonly CompletionProvider[];
  onChange(value: string): void;
}

/** Owns editor interaction only; providers and text edits do not depend on React. */
export const useCommandCompletion = ({ inputRef, registry, enabled, onChange, providers = NO_PROVIDERS }: CommandCompletionOptions) => {
  const [state, setState] = useState<CompletionState | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const acceptedRef = useRef<{ value: string; cursor: number } | null>(null);
  const observedRef = useRef<{ value: string; cursor: number; end: number } | null>(null);
  const pendingEditRef = useRef<{ value: string; cursor: number } | null>(null);
  const navigatedRef = useRef(false);
  const listId = useId();
  const revision = useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const edit = pendingEditRef.current;
    if (!input || !edit || input.value !== edit.value) return;
    pendingEditRef.current = null;
    input.focus({ preventScroll: true });
    input.setSelectionRange(edit.cursor, edit.cursor);
  });

  const dismiss = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setState(null);
  }, []);

  const request = useCallback((input: string, cursor: number, selectionEnd = cursor, explicit = false, force = false) => {
    const observed = observedRef.current;
    // React may emit select after a prevented navigation key. Keep the active
    // suggestion and an explicit dismissal until text or selection changes.
    if (!explicit && !force && observed?.value === input && observed.cursor === cursor && observed.end === selectionEnd) return;
    observedRef.current = { value: input, cursor, end: selectionEnd };
    navigatedRef.current = false;
    dismiss();
    if (!enabled) return;
    if (!explicit && acceptedRef.current?.value === input && acceptedRef.current.cursor === cursor) return;
    acceptedRef.current = null;
    const context = getCompletionContext(input, cursor, selectionEnd, explicit);
    if (!context) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const publish = (items: CompletionItem[]) => {
      if (controller.signal.aborted || inputRef.current !== document.activeElement) return;
      setState((current) => {
        if (items.length === 0) return null;
        const selected = navigatedRef.current && current?.context === context ? current.items[current.activeIndex] : null;
        const index = items.findIndex((item) => selected && completionItemKey(item) === completionItemKey(selected));
        return { context, items, activeIndex: Math.max(0, index) };
      });
    };
    void registry.complete(context, controller.signal, publish, providers).then((items) => {
      publish(items);
      if (requestRef.current === controller) requestRef.current = null;
    });
  }, [dismiss, enabled, inputRef, providers, registry]);

  const requestFromInput = useCallback((explicit = false, force = false) => {
    const input = inputRef.current;
    if (input) request(input.value, input.selectionStart, input.selectionEnd, explicit, force);
  }, [inputRef, request]);

  useEffect(() => {
    if (inputRef.current === document.activeElement) requestFromInput(false, true);
    else dismiss();
    return () => requestRef.current?.abort();
  }, [dismiss, inputRef, requestFromInput, revision]);

  useEffect(() => {
    if (!enabled) return undefined;
    const unsubscribes = providers.map((provider) => provider.subscribe?.(() => {
      if (inputRef.current === document.activeElement) requestFromInput(false, true);
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
  }, [enabled, inputRef, providers, requestFromInput]);

  const accept = (index: number) => {
    const input = inputRef.current;
    const item = state?.items[index];
    if (!state || !input || !item) return;
    if (input.value !== state.context.input || input.selectionStart !== state.context.cursor || input.selectionEnd !== state.context.cursor) {
      requestFromInput();
      return;
    }
    const edit = applyCompletion(state.context, item);
    dismiss();
    acceptedRef.current = edit;
    observedRef.current = { value: edit.value, cursor: edit.cursor, end: edit.cursor };
    pendingEditRef.current = edit;
    onChange(edit.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      requestFromInput(true);
      return true;
    }
    if (event.key === 'Escape' && (state || requestRef.current)) {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return true;
    }
    if (!state) return false;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      navigatedRef.current = true;
      setState({ ...state, activeIndex: (state.activeIndex + delta + state.items.length) % state.items.length });
      return true;
    }
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault();
      event.stopPropagation();
      accept(state.activeIndex);
      return true;
    }
    return false;
  };

  return { state, listId, requestFromInput, dismiss, accept, handleKeyDown, setActiveIndex: (activeIndex: number) => {
    navigatedRef.current = true;
    setState((current) => current ? { ...current, activeIndex } : null);
  } };
};
