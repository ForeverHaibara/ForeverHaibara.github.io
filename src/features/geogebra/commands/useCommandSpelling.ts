import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CompletionRegistry } from './completion/completionRegistry';
import type { CompletionItem, CompletionProvider } from './completion/types';
import { applySpellingCorrections, findSpellingCorrections, type SpellingCorrection } from './spellingSuggestions';

interface SpellingReview {
  input: string;
  corrections: SpellingCorrection[];
}

export const useCommandSpelling = (value: string, inputRef: RefObject<HTMLTextAreaElement | null>, registry: CompletionRegistry, providers: readonly CompletionProvider[], onChange: (value: string) => void) => {
  const [review, setReview] = useState<SpellingReview | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pendingEditRef = useRef<ReturnType<typeof applySpellingCorrections> | null>(null);
  const dismiss = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setReview(null);
  }, []);

  useEffect(() => {
    dismiss();
    return () => requestRef.current?.abort();
  }, [dismiss, value, registry, providers]);

  useLayoutEffect(() => {
    const edit = pendingEditRef.current;
    const input = inputRef.current;
    if (!edit || !input || input.value !== edit.value) return;
    pendingEditRef.current = null;
    input.focus({ preventScroll: true });
    input.setSelectionRange(edit.start, edit.end);
  });

  const check = (input: string) => {
    dismiss();
    const controller = new AbortController();
    requestRef.current = controller;
    const publish = (items: CompletionItem[]) => {
      if (controller.signal.aborted) return;
      const corrections = findSpellingCorrections(input, items);
      setReview((current) => corrections.length ? {
        input,
        corrections: corrections.map((correction) => {
          const previous = current?.input === input ? current.corrections.find((item) => item.start === correction.start) : null;
          return previous && correction.suggestions.includes(previous.replacement) ? { ...correction, replacement: previous.replacement } : correction;
        }),
      } : null);
    };
    void registry.complete({ input, cursor: 0, prefix: '', range: { start: 0, end: 0 }, mode: input.trimStart().startsWith('!') ? 'api' : 'command', explicit: true }, controller.signal, publish, providers).then(publish);
  };

  const accept = (): boolean => {
    if (!review || review.input !== value || inputRef.current?.value !== review.input) return false;
    const edit = applySpellingCorrections(review.input, review.corrections);
    dismiss();
    pendingEditRef.current = edit;
    onChange(edit.value);
    return true;
  };

  const choose = (index: number, replacement: string) => setReview((current) => current ? {
    ...current, corrections: current.corrections.map((correction, i) => i === index && correction.suggestions.includes(replacement) ? { ...correction, replacement } : correction),
  } : null);

  return { review: review?.input === value ? review : null, check, dismiss, accept, choose };
};
