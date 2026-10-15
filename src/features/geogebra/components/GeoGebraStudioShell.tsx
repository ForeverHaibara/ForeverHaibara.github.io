import React, { useEffect, useRef, useState } from 'react';
import GeoGebraCanvas from './GeoGebraCanvas';
import GeoGebraCommandBar from './GeoGebraCommandBar';
import GeoGebraFileActions from './GeoGebraFileActions';
import GeoGebraSidePanel from './GeoGebraSidePanel';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, StudioSettings } from '../types';
import type { DependencyGraph } from '../analysis/graphTypes';
import type { GeometryRelationsState } from '../analysis/useGeometryRelations';
import './geogebra-studio.css';

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
  const [fullscreen, setFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const analysisButtonRef = useRef<HTMLButtonElement>(null);
  const filesRef = useRef<HTMLDetailsElement>(null);
  const analysisHidden = settings.sidePanelCollapsed || focusMode;
  const commandsHidden = settings.commandBarCollapsed || focusMode;

  useEffect(() => {
    if (!fullscreen) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Keep the covered site navigation out of the keyboard focus order.
    const inertElements: Array<[HTMLElement, boolean]> = [];
    let element: HTMLElement | null = workspaceRef.current;
    while (element?.parentElement) {
      for (const sibling of element.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== element) {
          inertElements.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      element = element.parentElement;
      if (element === document.body) break;
    }
    const handleEscape = (event: KeyboardEvent) => {
      // Let GeoGebra's own menus and tools consume Escape first.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (filesRef.current?.open) {
        filesRef.current.open = false;
        filesRef.current.querySelector('summary')?.focus({ preventScroll: true });
        return;
      }
      setFocusMode(false);
      setFullscreen(false);
      window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus({ preventScroll: true }));
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = overflow;
      for (const [element, inert] of inertElements) element.inert = inert;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [fullscreen]);

  const toggleFullscreen = () => {
    if (filesRef.current) filesRef.current.open = false;
    setFocusMode(false);
    setFullscreen((current) => !current);
    window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus({ preventScroll: true }));
  };

  const hideAnalysis = () => {
    onSettingsChange({ ...settings, sidePanelCollapsed: true });
    analysisButtonRef.current?.focus({ preventScroll: true });
  };

  const controlClassName = 'rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500';

  return (
    <div ref={workspaceRef} className={fullscreen ? 'geogebra-studio-fullscreen' : 'relative left-1/2 w-screen max-w-none -translate-x-1/2 px-3 pb-5 sm:px-5 lg:px-7'} data-focus-mode={focusMode}>
      <div className="geogebra-studio-shell mx-auto flex w-full max-w-[1900px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/55 shadow-[0_24px_70px_rgba(59,130,246,0.14)] backdrop-blur-xl">
        <header className="geogebra-studio-header relative z-40 flex shrink-0 flex-col gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="geogebra-studio-title">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" /><h1 className="text-xl font-semibold tracking-tight text-slate-800">GeoGebra Studio</h1></div>
            {!fullscreen && <p className="mt-1 text-xs text-slate-500">A geometry workspace with an extensible command and proof surface.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Workspace layout">
            <details ref={filesRef} className="relative">
              <summary className={`${controlClassName} cursor-pointer list-none`}>Files <span aria-hidden="true">▾</span></summary>
              <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <GeoGebraFileActions onImport={onImport} onExport={onExport} onClearDraft={onClearDraft} onResetInitial={onResetInitial} />
              </div>
            </details>
            <button ref={analysisButtonRef} type="button" className={controlClassName} aria-expanded={!analysisHidden} aria-controls="geogebra-analysis-panel" onClick={() => onSettingsChange({ ...settings, sidePanelCollapsed: !settings.sidePanelCollapsed })}>Analysis <span aria-hidden="true">{analysisHidden ? '+' : '−'}</span></button>
            <button type="button" className={controlClassName} aria-expanded={!commandsHidden} aria-controls="geogebra-command-dock" onClick={() => onSettingsChange({ ...settings, commandBarCollapsed: !settings.commandBarCollapsed })}>Commands <span aria-hidden="true">{commandsHidden ? '+' : '−'}</span></button>
            {fullscreen && <button type="button" className={controlClassName} onClick={() => { if (filesRef.current) filesRef.current.open = false; setFocusMode(true); }}>Focus canvas</button>}
            <button ref={fullscreenButtonRef} type="button" className={`${controlClassName} !border-sky-200 !bg-sky-50 !text-sky-800`} aria-pressed={fullscreen} onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen workspace (Esc)' : 'Fill the browser window'}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
          </div>
        </header>
        <div className="geogebra-studio-body relative isolate flex flex-col lg:flex-row">
          <main className="geogebra-studio-canvas relative min-w-0 flex-1 overflow-hidden bg-slate-100/70" aria-label="GeoGebra canvas">
            <div className="absolute inset-0"><GeoGebraCanvas engine={engine} onReady={onReady} onError={onError} /></div>
            {!ready && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/55"><div className="rounded-2xl bg-white/90 px-5 py-4 text-center shadow-xl"><div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold text-slate-700">Loading GeoGebra...</p><p className="mt-1 text-xs text-slate-500">The official embedding script is being initialized.</p></div></div>}
            {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/85 p-6"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-5 text-center shadow-xl"><p className="text-sm font-semibold text-rose-700">GeoGebra could not load</p><p className="mt-2 text-xs leading-5 text-slate-600">{error}</p><p className="mt-3 text-xs text-slate-400">Check your network connection and refresh the page.</p></div></div>}
            {loadingMessage && <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/25 p-6 backdrop-blur-[2px]" aria-live="polite"><div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white/95 p-5 text-center shadow-2xl"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold text-slate-800">{loadingMessage}</p><p className="mt-1 text-xs leading-5 text-slate-500">Large GeoGebra files may take a moment to restore.</p></div></div>}
          </main>
          {fullscreen && !analysisHidden && <button type="button" className="geogebra-panel-backdrop absolute inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={hideAnalysis} aria-label="Close analysis panel" />}
          <GeoGebraSidePanel collapsed={analysisHidden} width={settings.sidePanelWidth} capabilities={capabilities} events={events} graph={graph} graphStatus={graphStatus} graphError={graphError} geometryRelations={geometryRelations} onRefreshGraph={onRefreshGraph} onToggle={hideAnalysis} onWidthChange={(sidePanelWidth) => onSettingsChange({ ...settings, sidePanelWidth })} />
        </div>
        <div id="geogebra-command-dock" hidden={commandsHidden} className="geogebra-command-dock shrink-0">
          <div className="border-t border-slate-200/80 bg-white/70 px-4 py-2 text-xs text-slate-500 sm:px-6" role="status"><span className="font-semibold text-slate-700">Last command:</span> {lastResult ? (lastResult.success ? `${lastResult.command} -> ${lastResult.labels.join(', ') || 'done'}` : `${lastResult.command} -> ${lastResult.error}`) : 'None yet'}</div>
          <GeoGebraCommandBar engine={engine} ready={ready} onResult={onCommandResult} />
        </div>
      </div>
      {fullscreen && focusMode && <div className="geogebra-focus-controls absolute bottom-4 right-4 z-30 flex gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-lg backdrop-blur-xl" role="group" aria-label="Canvas focus controls"><button type="button" autoFocus className={controlClassName} onClick={() => { setFocusMode(false); window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus({ preventScroll: true })); }}>Show workspace tools</button><button type="button" className={controlClassName} onClick={toggleFullscreen}>Exit fullscreen</button></div>}
    </div>
  );
};

export default GeoGebraStudioShell;
