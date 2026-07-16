import React from 'react';
import GeoGebraApiConsole from './GeoGebraApiConsole';
import GeoGebraCanvas from './GeoGebraCanvas';
import GeoGebraCommandBar from './GeoGebraCommandBar';
import GeoGebraFileActions from './GeoGebraFileActions';
import GeoGebraSidePanel from './GeoGebraSidePanel';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, StudioSettings } from '../types';

interface GeoGebraStudioShellProps {
  engine: GeoGebraEngine;
  ready: boolean;
  error: string | null;
  settings: StudioSettings;
  capabilities: EngineCapabilities;
  events: GeometryEvent[];
  lastResult: CommandResult | null;
  onReady(): void;
  onError(error: Error): void;
  onSettingsChange(settings: StudioSettings): void;
  onCommandResult(result: CommandResult): void;
  onImport(file: File): Promise<void>;
  onExport(): Promise<void>;
  onClearDraft(): Promise<void>;
}

const GeoGebraStudioShell: React.FC<GeoGebraStudioShellProps> = (props) => {
  const { engine, ready, error, settings, capabilities, events, lastResult, onReady, onError, onSettingsChange, onCommandResult, onImport, onExport, onClearDraft } = props;
  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-3 pb-5 sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-[1900px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/55 shadow-[0_24px_70px_rgba(59,130,246,0.14)] backdrop-blur-xl">
        <header className="flex flex-col gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" /><h1 className="text-xl font-semibold tracking-tight text-slate-800">GeoGebra Studio</h1></div>
            <p className="mt-1 text-xs text-slate-500">A geometry workspace with an extensible command and proof surface.</p>
          </div>
          <GeoGebraFileActions onImport={onImport} onExport={onExport} onClearDraft={onClearDraft} />
        </header>
        <div className="flex min-h-[520px] flex-col lg:flex-row">
          <main className="relative min-w-0 flex-1 bg-slate-100/70">
            <GeoGebraCanvas engine={engine} onReady={onReady} onError={onError} />
            {!ready && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/55"><div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-xl"><div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold text-slate-700">Loading GeoGebra...</p><p className="mt-1 text-xs text-slate-500">The official embedding script is being initialized.</p></div></div>}
            {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-6"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-xl"><p className="text-sm font-semibold text-rose-700">GeoGebra could not load</p><p className="mt-2 text-xs leading-5 text-slate-600">{error}</p><p className="mt-3 text-xs text-slate-400">Check your network connection and refresh the page.</p></div></div>}
          </main>
          <GeoGebraSidePanel collapsed={settings.sidePanelCollapsed} capabilities={capabilities} events={events} onToggle={() => onSettingsChange({ ...settings, sidePanelCollapsed: !settings.sidePanelCollapsed })} />
        </div>
        <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 text-xs text-slate-500 sm:px-6"><span className="font-semibold text-slate-700">Last command:</span> {lastResult ? (lastResult.success ? `${lastResult.command} -> ${lastResult.labels.join(', ') || 'done'}` : `${lastResult.command} -> ${lastResult.error}`) : 'None yet'}</div>
        <GeoGebraCommandBar engine={engine} ready={ready} onResult={onCommandResult} />
        <GeoGebraApiConsole engine={engine} expanded={settings.consoleExpanded} onToggle={() => onSettingsChange({ ...settings, consoleExpanded: !settings.consoleExpanded })} />
      </div>
    </div>
  );
};

export default GeoGebraStudioShell;
