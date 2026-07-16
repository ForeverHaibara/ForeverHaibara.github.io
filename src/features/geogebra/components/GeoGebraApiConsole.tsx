import React, { useState } from 'react';
import { formatApiResult, parseApiCall } from '../commands/apiConsoleParser';
import type { ApiConsoleEntry, GeoGebraEngine } from '../types';

interface GeoGebraApiConsoleProps {
  engine: GeoGebraEngine | null;
  expanded: boolean;
  onToggle(): void;
}

const GeoGebraApiConsole: React.FC<GeoGebraApiConsoleProps> = ({ engine, expanded, onToggle }) => {
  const [input, setInput] = useState('api getVersion()');
  const [entries, setEntries] = useState<ApiConsoleEntry[]>([]);

  const run = async () => {
    if (!engine || !input.trim()) return;
    const startedAt = performance.now();
    try {
      const call = parseApiCall(input);
      const result = await engine.callApi(call.method, call.args);
      setEntries((current) => [...current, {
        id: Date.now(), input, output: formatApiResult(result), durationMs: Math.round(performance.now() - startedAt), timestamp: Date.now(),
      }].slice(-50));
    } catch (error) {
      setEntries((current) => [...current, {
        id: Date.now(), input, error: error instanceof Error ? error.message : 'API call failed.', durationMs: Math.round(performance.now() - startedAt), timestamp: Date.now(),
      }].slice(-50));
    }
  };

  return (
    <section className="border-t border-slate-200/80 bg-slate-950 text-slate-100" aria-label="GeoGebra API console">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-900">
        <span className="flex items-center gap-2 text-sm font-semibold"><span className="text-sky-300">›_</span> API Console</span>
        <span className="text-xs text-slate-400">{expanded ? 'Collapse' : 'Expand'}</span>
      </button>
      {expanded && (
        <div className="border-t border-slate-800 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void run(); } }}
              placeholder={'api getObjectType("A")'}
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-sky-100 outline-none focus:border-sky-400"
              data-testid="geogebra-api-input"
            />
            <button type="button" onClick={() => void run()} disabled={!engine} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Call API</button>
            <button type="button" onClick={() => setEntries([])} className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800">Clear</button>
          </div>
          <div className="mt-3 max-h-40 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-xs" data-testid="geogebra-api-output">
            {entries.length === 0 ? <p className="text-slate-500">Try `api getVersion()` or `api getAllObjectNames()`.</p> : entries.map((entry) => (
              <div key={entry.id} className="border-b border-slate-800 py-2 last:border-0">
                <p className="text-sky-300">$ {entry.input} <span className="text-slate-600">({entry.durationMs}ms)</span></p>
                {entry.error ? <p className="mt-1 whitespace-pre-wrap text-rose-300">{entry.error}</p> : <pre className="mt-1 whitespace-pre-wrap text-emerald-300">{entry.output}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default GeoGebraApiConsole;
