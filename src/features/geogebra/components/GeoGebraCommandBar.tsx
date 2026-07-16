import React, { useRef, useState } from 'react';
import { formatApiResult, parseApiCall } from '../commands/apiConsoleParser';
import { CommandHistory } from '../commands/commandHistory';
import { executeCommandPipeline } from '../commands/commandPipeline';
import type { ApiConsoleResult, CommandResult, GeoGebraEngine } from '../types';

interface GeoGebraCommandBarProps {
  engine: GeoGebraEngine | null;
  ready: boolean;
  onResult(result: CommandResult): void;
}

const GeoGebraCommandBar: React.FC<GeoGebraCommandBarProps> = ({ engine, ready, onResult }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [apiResult, setApiResult] = useState<ApiConsoleResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef(new CommandHistory());

  const refocus = () => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const execute = async () => {
    if (!engine || !value.trim() || busy) return;
    setBusy(true);
    const input = value;
    historyRef.current.push(input);

    if (input.trimStart().startsWith('!')) {
      try {
        const call = parseApiCall(input);
        const result = await engine.callApi(call.method, call.args);
        setApiResult({ input, output: formatApiResult(result) });
      } catch (error) {
        setApiResult({ input, error: error instanceof Error ? error.message : 'API call failed.' });
      } finally {
        setBusy(false);
        setValue('');
        refocus();
      }
      return;
    }

    const result = await executeCommandPipeline(engine, input);
    onResult(result);
    setBusy(false);
    if (result.success) setValue('');
    refocus();
  };

  return (
    <section className="border-t border-slate-200/80 bg-white/85 p-3 backdrop-blur-xl" aria-label="GeoGebra command input">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">GGB Command Bar</h2>
          <p className="text-xs text-slate-500">Commands are processed here before reaching GeoGebra.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {ready ? 'Engine ready' : 'Waiting for engine'}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void execute();
            } else if (event.key === 'ArrowUp' && !value.includes('\n')) {
              event.preventDefault();
              setValue(historyRef.current.previous());
            } else if (event.key === 'ArrowDown' && !value.includes('\n')) {
              event.preventDefault();
              setValue(historyRef.current.next());
            }
          }}
          disabled={!ready || busy}
          placeholder={'A = (0, 0)\nB = (4, 0)\nCircle(A, B, (1, 3))\n!getObjectType("A")'}
          className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="geogebra-command-input"
        />
        <button
          type="button"
          onClick={() => void execute()}
          disabled={!ready || busy || !value.trim()}
          className="rounded-2xl bg-gradient-to-br from-blue-700 to-sky-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Running...' : 'Run command'}
        </button>
      </div>
      {apiResult && (
        <div className={`mt-2 rounded-xl border px-3 py-2 font-mono text-xs ${apiResult.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`} data-testid="geogebra-command-result">
          <p className="font-semibold">{apiResult.input}</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">{apiResult.error ?? apiResult.output}</pre>
        </div>
      )}
    </section>
  );
};

export default GeoGebraCommandBar;
