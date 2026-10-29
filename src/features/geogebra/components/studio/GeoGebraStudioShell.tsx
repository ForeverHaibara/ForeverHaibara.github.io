import React, { useEffect, useRef, useState } from 'react';
import GeoGebraCanvas from './GeoGebraCanvas';
import GeoGebraCommandBar from '../command/GeoGebraCommandBar';
import GeoGebraFileActions from './GeoGebraFileActions';
import GeoGebraSidePanel from './GeoGebraSidePanel';
import GeoGebraSettingsPanel from '../settings/GeoGebraSettingsPanel';
import GeoGebraQuickStyle from '../settings/GeoGebraQuickStyle';
import ProofSettingsPanel from '../settings/ProofSettingsPanel';
import { ReasoningPreferencesContext } from '../../reasoning/preferences/ReasoningPreferencesContext';
import { normalizeReasoningPreferences, readReasoningPreferences, saveReasoningPreferences } from '../../reasoning/preferences/reasoningPreferences';
import StudioIcon, { StudioIconButton } from './StudioIcon';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, StudioSettings } from '../../types';
import type { DependencyGraph } from '../../analysis/graphTypes';
import type { GeometryRelationsState } from '../../analysis/useGeometryRelations';
import type { GgbPreferences, ObjectStyle } from '../../settings/types';
import { useObjectLink } from '../../interaction/useObjectLink';
import './geogebra-studio.css';

interface GeoGebraStudioShellProps {
  engine: GeoGebraEngine;
  ready: boolean;
  error: string | null;
  loadingMessage: string | null;
  settings: StudioSettings;
  preferences: GgbPreferences;
  preferenceError: string | null;
  onPreferencesChange(value: GgbPreferences): void;
  onApplyPreferences(): Promise<void>;
  onEditObjectStyle(names: readonly string[], patch: ObjectStyle | null): Promise<void>;
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
  const { engine, ready, error, loadingMessage, settings, preferences, preferenceError, onPreferencesChange, onApplyPreferences, capabilities, events, graph, graphStatus, graphError, geometryRelations, onRefreshGraph, lastResult, onReady, onError, onSettingsChange, onCommandResult, onImport, onExport, onClearDraft, onResetInitial } = props;
  const [fullscreen, setFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proofSettingsOpen, setProofSettingsOpen] = useState(false);
  const [reasoningPreferences, setReasoningPreferences] = useState(readReasoningPreferences);
  const [reasoningStorageUnavailable, setReasoningStorageUnavailable] = useState(false);
  const proofSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const closeProofSettings = () => {
    setProofSettingsOpen(false);
    window.requestAnimationFrame(() => proofSettingsButtonRef.current?.focus({ preventScroll: true }));
  };
  const workspaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const analysisButtonRef = useRef<HTMLButtonElement>(null);
  const filesRef = useRef<HTMLDetailsElement>(null);
  const analysisHidden = settings.sidePanelCollapsed || focusMode;
  const commandsHidden = settings.commandBarCollapsed || focusMode;
  const floating = fullscreen && settings.commandBarFloating;
  const objectLink = useObjectLink(engine, ready);
  const closeSettings = () => { setSettingsOpen(false); settingsButtonRef.current?.focus(); };

  useEffect(() => {
    if (analysisHidden || settingsOpen || proofSettingsOpen) objectLink.hover(null);
  }, [analysisHidden, settingsOpen, proofSettingsOpen, objectLink.hover]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.inert = settingsOpen;
  }, [settingsOpen]);

  useEffect(() => {
    const closeFiles = (event: PointerEvent) => {
      if (filesRef.current && !filesRef.current.contains(event.target as Node)) filesRef.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (filesRef.current?.open) {
        filesRef.current.open = false;
        filesRef.current.querySelector('summary')?.focus();
        return;
      }
      if (fullscreen) {
        setFocusMode(false); setFullscreen(false);
        window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
      }
    };
    window.addEventListener('pointerdown', closeFiles);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', closeFiles); window.removeEventListener('keydown', escape); };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const inertElements: Array<[HTMLElement, boolean]> = [];
    let element: HTMLElement | null = workspaceRef.current;
    while (element?.parentElement) {
      for (const sibling of element.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== element) { inertElements.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      element = element.parentElement;
      if (element === document.body) break;
    }
    return () => { document.body.style.overflow = overflow; for (const [node, inert] of inertElements) node.inert = inert; };
  }, [fullscreen]);

  const toggleFullscreen = () => {
    if (filesRef.current) filesRef.current.open = false;
    setFocusMode(false); setFullscreen((current) => !current);
    window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus());
  };
  const hideAnalysis = () => { onSettingsChange({ ...settings, sidePanelCollapsed: true }); analysisButtonRef.current?.focus(); };

  return <div ref={workspaceRef} className={fullscreen ? 'geogebra-studio-fullscreen' : 'relative left-1/2 w-screen max-w-none -translate-x-1/2 px-3 pb-5 sm:px-5 lg:px-7'} data-focus-mode={focusMode}>
    <ReasoningPreferencesContext.Provider value={reasoningPreferences}><div className="geogebra-studio-shell" data-floating-commands={floating}>
      <header className="geogebra-studio-header">
        <div className="geogebra-studio-title"><span className="ggb-brand-mark"><StudioIcon name="geometry" size={22} /></span><div><h1>GeoGebra <span>Studio</span></h1><p>Geometry, with room to think.</p></div></div>
        <div className="ggb-workspace-toolbar" role="toolbar" aria-label="Workspace tools">
          <button ref={proofSettingsButtonRef} type="button" className="ggb-icon-button" title="Proof settings" aria-label="Proof settings" aria-expanded={proofSettingsOpen} aria-controls="geogebra-proof-settings" disabled={settingsOpen} onClick={() => { if (filesRef.current) filesRef.current.open = false; setProofSettingsOpen(!proofSettingsOpen); }}><StudioIcon name="sparkles" /></button>
          <GeoGebraQuickStyle engine={engine} names={objectLink.selectedNames} disabled={!ready || settingsOpen || Boolean(loadingMessage)} onOpen={() => { objectLink.hover(null); if (filesRef.current) filesRef.current.open = false; }} onEdit={props.onEditObjectStyle} />
          <button ref={settingsButtonRef} type="button" className="ggb-icon-button" title="Workspace settings" aria-label="Workspace settings" aria-expanded={settingsOpen} aria-controls="geogebra-settings-panel" onClick={() => { if (filesRef.current) filesRef.current.open = false; setSettingsOpen(!settingsOpen); }}><StudioIcon name="settings" />{preferenceError && <span className="ggb-button-alert" />}</button>
          <details ref={filesRef} className="ggb-files-menu">
            <summary className="ggb-icon-button" title="Files" aria-label="Files"><StudioIcon name="files" /></summary>
            <div className="ggb-files-popover"><span className="ggb-eyebrow">CONSTRUCTION</span><GeoGebraFileActions onImport={onImport} onExport={onExport} onClearDraft={onClearDraft} onResetInitial={onResetInitial} onAction={() => { if (filesRef.current) filesRef.current.open = false; filesRef.current?.querySelector('summary')?.focus(); }} /></div>
          </details>
          <span className="ggb-toolbar-divider" />
          <button type="button" className="ggb-icon-button" title="Toggle Algebra view" aria-label="Toggle Algebra view" aria-pressed={preferences.algebra} disabled={!ready} onClick={() => onPreferencesChange({ ...preferences, algebra: !preferences.algebra })}><StudioIcon name="left" /></button>
          <button ref={analysisButtonRef} type="button" className="ggb-icon-button" title="Toggle analysis panel" aria-label="Toggle analysis panel" aria-expanded={!analysisHidden} aria-controls="geogebra-analysis-panel" onClick={() => { setFocusMode(false); onSettingsChange({ ...settings, sidePanelCollapsed: !settings.sidePanelCollapsed }); }}><StudioIcon name="right" /></button>
          <StudioIconButton icon="bottom" label="Toggle command bar" aria-expanded={!commandsHidden} aria-controls="geogebra-command-dock" onClick={() => { setFocusMode(false); onSettingsChange({ ...settings, commandBarCollapsed: !settings.commandBarCollapsed }); }} />
          {fullscreen && <StudioIconButton icon={floating ? 'pin' : 'float'} label={floating ? 'Dock command bar' : 'Float command bar'} aria-pressed={!floating} onClick={() => onSettingsChange({ ...settings, commandBarFloating: !settings.commandBarFloating })} />}
          <span className="ggb-toolbar-divider" />
          {fullscreen && <StudioIconButton icon="focus" label="Focus canvas" onClick={() => setFocusMode(true)} />}
          <button ref={fullscreenButtonRef} type="button" className="ggb-icon-button ggb-fullscreen-button" title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen workspace'} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen workspace'} aria-pressed={fullscreen} onClick={toggleFullscreen}><StudioIcon name={fullscreen ? 'collapse' : 'expand'} /></button>
        </div>
      </header>
      <div className="ggb-workspace-content" ref={contentRef}>
        <div className="geogebra-studio-body relative isolate flex flex-col lg:flex-row">
          <main className="geogebra-studio-canvas relative min-w-0 flex-1 overflow-hidden bg-slate-100/70" aria-label="GeoGebra canvas">
            <div className="absolute inset-0"><GeoGebraCanvas engine={engine} onReady={onReady} onError={onError} /></div>
            {!ready && !error && <div className="ggb-canvas-overlay"><div className="ggb-loading-card"><span className="ggb-spinner" /><strong>Preparing your workspace</strong><p>Loading GeoGebra…</p></div></div>}
            {error && <div className="ggb-canvas-overlay"><div className="ggb-loading-card"><strong>GeoGebra could not load</strong><p>{error}</p><p>Check your connection and refresh the page.</p></div></div>}
            {loadingMessage && <div className="ggb-canvas-overlay" aria-live="polite"><div className="ggb-loading-card"><span className="ggb-spinner" /><strong>{loadingMessage}</strong></div></div>}
          </main>
          {fullscreen && !analysisHidden && <button type="button" className="geogebra-panel-backdrop absolute inset-0 z-20 bg-slate-900/20 lg:hidden" onClick={hideAnalysis} aria-label="Close analysis panel" />}
          <GeoGebraSidePanel engine={engine} objectLink={objectLink} collapsed={analysisHidden} width={settings.sidePanelWidth} capabilities={capabilities} events={events} graph={graph} graphStatus={graphStatus} graphError={graphError} geometryRelations={geometryRelations} onRefreshGraph={onRefreshGraph} onToggle={hideAnalysis} onWidthChange={(sidePanelWidth) => onSettingsChange({ ...settings, sidePanelWidth })} />
        </div>
        <div id="geogebra-command-dock" hidden={commandsHidden} className="geogebra-command-dock">
          <GeoGebraCommandBar engine={engine} ready={ready} helperMode={settings.helperMode} onResult={onCommandResult} />
          {lastResult && <div className={`ggb-command-status ${lastResult.success ? '' : 'error'}`} role="status" title={lastResult.command}><span className={`ggb-status-dot ${lastResult.success ? '' : 'error'}`} />{lastResult.success ? `${lastResult.command} → ${lastResult.labels.join(', ') || 'done'}` : lastResult.error}</div>}
        </div>
      </div>
      {proofSettingsOpen && <ProofSettingsPanel preferences={reasoningPreferences} discovery={geometryRelations} storageUnavailable={reasoningStorageUnavailable} onApply={(value) => { const next = normalizeReasoningPreferences(value); setReasoningPreferences(next); setReasoningStorageUnavailable(!saveReasoningPreferences(next)); }} onClose={closeProofSettings} />}
      {settingsOpen && <><button className="ggb-settings-backdrop" type="button" aria-label="Dismiss settings" tabIndex={-1} onClick={closeSettings} /><GeoGebraSettingsPanel preferences={preferences} helperMode={settings.helperMode} onHelperModeChange={(value) => onSettingsChange({ ...settings, helperMode: value })} ready={ready} error={preferenceError} onChange={onPreferencesChange} onApplyToAll={onApplyPreferences} onClose={closeSettings} /></>}
    </div></ReasoningPreferencesContext.Provider>
    {fullscreen && focusMode && <div className="geogebra-focus-controls" role="group" aria-label="Canvas focus controls"><StudioIconButton autoFocus icon="focus" label="Show workspace tools" onClick={() => { setFocusMode(false); window.requestAnimationFrame(() => fullscreenButtonRef.current?.focus()); }} /><StudioIconButton icon="collapse" label="Exit fullscreen" onClick={toggleFullscreen} /></div>}
  </div>;
};

export default GeoGebraStudioShell;
