import React, { useRef, useState } from 'react';
import { CommandHistory } from '../commands/commandHistory';
import { executeCommandPipeline } from '../commands/commandPipeline';
import type { CommandResult, GeoGebraEngine } from '../types';

interface GeoGebraCommandBarProps {
  engine: GeoGebraEngine | null;
  ready: boolean;
  onResult(result: CommandResult): void;
}

const GeoGebraCommandBar: React.FC<GeoGebraCommandBarProps> = ({ engine, ready, onResult }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const historyRef = useRef(new CommandHistory());

  const execute = async () => {
    if (!engine || !value.trim() || busy) return;
    setBusy(true);
    historyRef.current.push(value);
    const result = await executeCommandPipeline(engine, value);
    onResult(result);
    setBusy(false);
    if (result.success) setValue('');
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
          placeholder={'A = (0, 0)\nB = (4, 0)\nCircle(A, B, (1, 3))'}
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
    </section>
  );
};

export default GeoGebraCommandBar;
