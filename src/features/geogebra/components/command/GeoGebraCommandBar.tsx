import React, { useId, useMemo, useRef, useState } from 'react';
import { formatApiResult, parseApiCall } from '../../commands/apiConsoleParser';
import { CommandHistory } from '../../commands/commandHistory';
import { executeCommandPipeline } from '../../commands/commandPipeline';
import type { ApiConsoleResult, CommandResult, GeoGebraEngine } from '../../types';
import type { CompletionRegistry } from '../../commands/completion/completionRegistry';
import { studioCompletionRegistry } from '../../commands/completion/studioCompletionRegistry';
import { useCommandCompletion } from '../../commands/completion/useCommandCompletion';
import GeoGebraCompletionMenu from './GeoGebraCompletionMenu';
import { createObjectCompletionProvider } from '../../commands/completion/objectCompletionProvider';
import { createFileToolCompletionProvider } from '../../commands/completion/fileToolCompletionProvider';
import { useCommandSpelling } from '../../commands/useCommandSpelling';
import GeoGebraSpellingReview from './GeoGebraSpellingReview';
import StudioIcon from '../studio/StudioIcon';

interface GeoGebraCommandBarProps {
  engine: GeoGebraEngine | null;
  ready: boolean;
  onResult(result: CommandResult): void;
  completionRegistry?: CompletionRegistry;
}

const GeoGebraCommandBar: React.FC<GeoGebraCommandBarProps> = ({ engine, ready, onResult, completionRegistry = studioCompletionRegistry }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiResult, setApiResult] = useState<ApiConsoleResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef(new CommandHistory());
  const composingRef = useRef(false);
  const helpId = useId();
  const providers = useMemo(() => engine ? [createObjectCompletionProvider(engine), createFileToolCompletionProvider(engine)] : [], [engine]);
  const spelling = useCommandSpelling(value, inputRef, completionRegistry, providers, setValue);
  const completion = useCommandCompletion({ inputRef, registry: completionRegistry, providers, enabled: ready && !busy && !spelling.review, onChange: setValue });

  const refocus = () => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const execute = async () => {
    if (!engine || !value.trim() || busy) return;
    completion.dismiss();
    spelling.dismiss();
    setApiResult(null);
    setBusy(true);
    const input = value;
    historyRef.current.push(input);

    if (input.trimStart().startsWith('!')) {
      try {
        const call = parseApiCall(input);
        const result = await engine.callApi(call.method, call.args);
        setApiResult({ input, output: formatApiResult(result) });
        onResult({ success: true, command: input, labels: [], timestamp: Date.now() });
        setValue('');
      } catch (error) {
        setApiResult({ input, error: error instanceof Error ? error.message : 'API call failed.' });
        onResult({ success: false, command: input, labels: [], error: error instanceof Error ? error.message : 'API call failed.', timestamp: Date.now() });
        spelling.check(input);
      } finally {
        setBusy(false);
        refocus();
      }
      return;
    }

    try {
      const result = await executeCommandPipeline(engine, input);
      onResult(result);
      if (result.success) setValue('');
      else spelling.check(input);
    } catch (error) {
      onResult({ success: false, command: input, labels: [], error: error instanceof Error ? error.message : 'Command failed.', timestamp: Date.now() });
      spelling.check(input);
    } finally {
      setBusy(false);
      refocus();
    }
  };

  return (
    <section className="ggb-command-bar" aria-label="GeoGebra command input">
      <div className="ggb-command-input-row">
        <span className="ggb-command-prompt" title={ready ? 'Engine ready' : 'Waiting for engine'} aria-hidden="true">›</span>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (!composingRef.current) completion.requestFromInput();
          }}
          onFocus={() => completion.requestFromInput(false, true)}
          onBlur={completion.dismiss}
          onSelect={() => { if (!composingRef.current) completion.requestFromInput(); }}
          onCompositionStart={() => { composingRef.current = true; completion.dismiss(); }}
          onCompositionEnd={() => { composingRef.current = false; completion.requestFromInput(); }}
          onKeyUp={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (composingRef.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
              event.stopPropagation();
              return;
            }
            if (event.key !== 'Escape') event.stopPropagation();
            if (spelling.review && (event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
              event.preventDefault();
              spelling.accept();
            } else if (spelling.review && event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              spelling.dismiss();
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              void execute();
            } else if (completion.handleKeyDown(event)) {
              return;
            } else if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.stopPropagation();
              void execute();
            } else if (event.key === 'ArrowUp' && !value.includes('\n')) {
              event.preventDefault();
              event.stopPropagation();
              setValue(historyRef.current.previous());
            } else if (event.key === 'ArrowDown' && !value.includes('\n')) {
              event.preventDefault();
              event.stopPropagation();
              setValue(historyRef.current.next());
            }
          }}
          disabled={!ready || busy}
          role="combobox"
          aria-label="GeoGebra commands"
          aria-autocomplete="list"
          aria-expanded={Boolean(completion.state)}
          aria-controls={completion.state ? completion.listId : undefined}
          aria-activedescendant={completion.state ? `${completion.listId}-${completion.state.activeIndex}` : undefined}
          aria-describedby={helpId}
          placeholder="Enter a command or !API call…"
          rows={1}
          className="ggb-command-textarea"
          data-testid="geogebra-command-input"
        />
        <button
          type="button"
          onClick={() => void execute()}
          disabled={!ready || busy || !value.trim()}
          className="ggb-command-run"
          title="Run command (Ctrl+Enter)"
          aria-label={busy ? 'Running command' : 'Run command'}
        >
          {busy ? <span className="ggb-spinner" /> : <StudioIcon name="run" size={19} />}
        </button>
      </div>
      {spelling.review && <GeoGebraSpellingReview corrections={spelling.review.corrections} onChoose={spelling.choose} onAccept={spelling.accept} onDismiss={spelling.dismiss} />}
      <p id={helpId} className="sr-only">Tab or Enter to complete. Ctrl+Space for suggestions. Ctrl+Enter to run. Shift+Enter for a new line.</p>
      {completion.state && inputRef.current && <GeoGebraCompletionMenu anchor={inputRef.current} listId={completion.listId} items={completion.state.items} prefix={completion.state.context.prefix} activeIndex={completion.state.activeIndex} onAccept={completion.accept} onActiveIndexChange={completion.setActiveIndex} onDismiss={completion.dismiss} />}
      {apiResult && (
        <div className={`mt-2 rounded-xl border px-3 py-2 font-mono text-xs ${apiResult.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} data-testid="geogebra-command-result">
          <p className="truncate font-semibold" title={apiResult.input}>{apiResult.input}</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">{apiResult.error ?? apiResult.output}</pre>
        </div>
      )}
    </section>
  );
};

export default GeoGebraCommandBar;
