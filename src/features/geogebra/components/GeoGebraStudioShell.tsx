import React from 'react';
import GeoGebraCanvas from './GeoGebraCanvas';
import GeoGebraCommandBar from './GeoGebraCommandBar';
import GeoGebraFileActions from './GeoGebraFileActions';
import GeoGebraSidePanel from './GeoGebraSidePanel';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, StudioSettings } from '../types';
import type { DependencyGraph } from '../analysis/graphTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';

interface GeoGebraStudioShellProps {
  engine: GeoGebraEngine;
  ready: boolean;
  error: string | null;
  loadingMessage: string | null;
  settings: StudioSettings;
  capabilities: EngineCapabilities;
  events: GeometryEvent[];
  graph: DependencyGraph | null;
  graphStatus: 'idle' | 'loading' | 'ready' | 'error';
  graphError: string | null;
  geometryRelations: GeometryRelationsState;
  onRefreshGraph(): void;
  lastResult: CommandResult | null;
  onReady(): void;
  onError(error: Error): void;
  onSettingsChange(settings: StudioSettings): void;
  onCommandResult(result: CommandResult): void;
  onImport(file: File): Promise<void>;
  onExport(): Promise<void>;
  onClearDraft(): Promise<void>;
  onResetInitial(): Promise<void>;
}

const GeoGebraStudioShell: React.FC<GeoGebraStudioShellProps> = (props) => {
  const { engine, ready, error, loadingMessage, settings, capabilities, events, graph, graphStatus, graphError, geometryRelations, onRefreshGraph, lastResult, onReady, onError, onSettingsChange, onCommandResult, onImport, onExport, onClearDraft, onResetInitial } = props;
  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-3 pb-5 sm:px-5 lg:px-7">
      <div className="mx-auto flex w-full max-w-[1900px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/55 shadow-[0_24px_70px_rgba(59,130,246,0.14)] backdrop-blur-xl">
        <header className="flex flex-col gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" /><h1 className="text-xl font-semibold tracking-tight text-slate-800">GeoGebra Studio</h1></div>
            <p className="mt-1 text-xs text-slate-500">A geometry workspace with an extensible command and proof surface.</p>
          </div>
          <GeoGebraFileActions onImport={onImport} onExport={onExport} onClearDraft={onClearDraft} onResetInitial={onResetInitial} />
        </header>
        <div className="flex min-h-[680px] flex-col lg:flex-row" style={{ minHeight: 'min(82vh, 980px)' }}>
          <main className="relative min-h-[680px] min-w-0 flex-1 bg-slate-100/70 lg:min-h-0" style={{ minHeight: 'inherit' }}>
            <GeoGebraCanvas engine={engine} onReady={onReady} onError={onError} />
            {!ready && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/55"><div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-xl"><div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold text-slate-700">Loading GeoGebra...</p><p className="mt-1 text-xs text-slate-500">The official embedding script is being initialized.</p></div></div>}
            {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-6"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-xl"><p className="text-sm font-semibold text-rose-700">GeoGebra could not load</p><p className="mt-2 text-xs leading-5 text-slate-600">{error}</p><p className="mt-3 text-xs text-slate-400">Check your network connection and refresh the page.</p></div></div>}
            {loadingMessage && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-[2px]" aria-live="polite"><div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white/95 p-5 text-center shadow-2xl"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold text-slate-800">{loadingMessage}</p><p className="mt-1 text-xs leading-5 text-slate-500">Large GeoGebra files may take a moment to restore.</p></div></div>}
          </main>
          <GeoGebraSidePanel collapsed={settings.sidePanelCollapsed} width={settings.sidePanelWidth} capabilities={capabilities} events={events} graph={graph} graphStatus={graphStatus} graphError={graphError} geometryRelations={geometryRelations} onRefreshGraph={onRefreshGraph} onToggle={() => onSettingsChange({ ...settings, sidePanelCollapsed: !settings.sidePanelCollapsed })} onWidthChange={(sidePanelWidth) => onSettingsChange({ ...settings, sidePanelWidth })} />
        </div>
        <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 text-xs text-slate-500 sm:px-6"><span className="font-semibold text-slate-700">Last command:</span> {lastResult ? (lastResult.success ? `${lastResult.command} -> ${lastResult.labels.join(', ') || 'done'}` : `${lastResult.command} -> ${lastResult.error}`) : 'None yet'}</div>
        <GeoGebraCommandBar engine={engine} ready={ready} onResult={onCommandResult} />
      </div>
    </div>
  );
};

export default GeoGebraStudioShell;
