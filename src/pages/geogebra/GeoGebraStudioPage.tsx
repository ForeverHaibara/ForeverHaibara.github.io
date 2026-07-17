import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STUDIO_SETTINGS, GEOGEBRA_AUTOSAVE_DELAY, GEOGEBRA_LATEST_PROJECT_ID } from '../../features/geogebra/config';
import GeoGebraStudioShell from '../../features/geogebra/components/GeoGebraStudioShell';
import { GeoGebraEmbeddingAdapter } from '../../features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { IndexedDbProjectStore } from '../../features/geogebra/persistence/indexedDbProjectStore';
import { base64ToFile, blobToDownload } from '../../features/geogebra/persistence/ggbFileCodec';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, GeometryProjectRecord, StudioSettings } from '../../features/geogebra/types';
import { useDependencyGraph } from '../../features/geogebra/analysis/useDependencyGraph';

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
};

const readSettings = (): StudioSettings => {
  try {
    const raw = window.localStorage.getItem('geogebra-studio-settings');
    return raw ? { ...DEFAULT_STUDIO_SETTINGS, ...JSON.parse(raw) as Partial<StudioSettings> } : { ...DEFAULT_STUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
};

const GeoGebraStudioPage: React.FC = () => {
  const [engine, setEngine] = useState<GeoGebraEngine>(() => new GeoGebraEmbeddingAdapter());
  const store = useMemo(() => new IndexedDbProjectStore(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(readSettings);
  const [capabilities, setCapabilities] = useState<EngineCapabilities>(engine.getCapabilities());
  const [events, setEvents] = useState<GeometryEvent[]>([]);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const restoredRef = useRef(false);
  const loadOperationRef = useRef(0);
  const resettingRef = useRef(false);
  const dependencyGraphState = useDependencyGraph(engine, ready);

  useEffect(() => {
    const unsubscribe = engine.subscribe((event) => setEvents((current) => [...current, event].slice(-100)));
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === '_blank' || !target.href) return;
      if (target.href === window.location.href) return;
      if (!window.confirm('You may have unsaved GeoGebra changes. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    window.__GGB_DEBUG__ = {
      engine: ready ? engine : null,
      call: (method, ...args) => engine.callApi(method, args),
      command: (command) => engine.executeCommand(command),
      status: () => ({ ready, capabilities: ready ? engine.getCapabilities() : null }),
    };
    return () => {
      delete window.__GGB_DEBUG__;
    };
  }, [engine, ready]);

  useEffect(() => {
    try {
      window.localStorage.setItem('geogebra-studio-settings', JSON.stringify(settings));
    } catch {
      // Settings are optional; the studio remains usable if storage is disabled.
    }
  }, [settings]);

  const resetToInitial = useCallback(async () => {
    if (!window.confirm('Reset GeoGebra Studio to its initial state? The current construction and local draft will be discarded.')) return;
    loadOperationRef.current += 1;
    resettingRef.current = true;
    setLoadingMessage(null);

    // GeoGebra's reset() only changes the view. Recreate the embedding so the
    // document itself returns to a fresh, empty initial state.
    engine.dispose();
    await store.clear().catch(() => undefined);
    setSettings({ ...DEFAULT_STUDIO_SETTINGS });
    setReady(false);
    setError(null);
    setEvents([]);
    setHasUnsavedChanges(false);
    setLastResult({ success: true, command: 'Reset initial state', labels: [], timestamp: Date.now() });
    restoredRef.current = false;

    const nextEngine = new GeoGebraEmbeddingAdapter();
    setCapabilities(nextEngine.getCapabilities());
    setEngine(nextEngine);
  }, [engine, store]);

  const handleReady = useCallback(() => {
    setReady(true);
    setCapabilities(engine.getCapabilities());
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (resettingRef.current) {
      resettingRef.current = false;
      return;
    }
    const operationId = ++loadOperationRef.current;
    setLoadingMessage('Restoring your last GeoGebra draft...');
    void store.getLatest().then(async (project) => {
      if (!project?.ggbBase64 || operationId !== loadOperationRef.current) return;
      await engine.importGgb(base64ToFile(project.ggbBase64));
      dependencyGraphState.refresh();
    }).catch(() => undefined).finally(() => {
      if (operationId === loadOperationRef.current) setLoadingMessage(null);
    });
  }, [dependencyGraphState.refresh, engine, store]);

  const handleError = useCallback((loadError: Error) => {
    resettingRef.current = false;
    setError(loadError.message);
    setCapabilities(engine.getCapabilities());
  }, [engine]);

  const handleSettingsChange = useCallback((nextSettings: StudioSettings) => setSettings(nextSettings), []);

  const saveDraft = useCallback(async () => {
    if (!ready) return;
    try {
      const blob = await engine.exportGgb();
      const record: GeometryProjectRecord = {
        id: GEOGEBRA_LATEST_PROJECT_ID,
        title: 'GeoGebra Studio Draft',
        ggbBase64: await blobToBase64(blob),
        settings,
        updatedAt: Date.now(),
      };
      await store.save(record);
      setHasUnsavedChanges(false);
    } catch {
      // Some browser privacy modes disable IndexedDB; no user action should be blocked.
    }
  }, [engine, ready, settings, store]);

  useEffect(() => {
    if (!ready) return undefined;
    const timeout = window.setTimeout(() => void saveDraft(), GEOGEBRA_AUTOSAVE_DELAY);
    return () => window.clearTimeout(timeout);
  }, [events, lastResult, ready, saveDraft]);

  const handleCommandResult = useCallback((result: CommandResult) => {
    setLastResult(result);
    if (result.success) setHasUnsavedChanges(true);
  }, []);

  const handleImport = useCallback(async (file: File) => {
    const operationId = ++loadOperationRef.current;
    setLoadingMessage(`Opening ${file.name}...`);
    try {
      await engine.importGgb(file);
      dependencyGraphState.refresh();
      if (operationId !== loadOperationRef.current) return;
      setEvents((current) => [...current, { type: 'clear', timestamp: Date.now() }]);
      setHasUnsavedChanges(true);
      setLastResult({ success: true, command: `Imported ${file.name}`, labels: [], timestamp: Date.now() });
    } finally {
      if (operationId === loadOperationRef.current) setLoadingMessage(null);
    }
  }, [dependencyGraphState.refresh, engine]);

  const handleExport = useCallback(async () => {
    const blob = await engine.exportGgb();
    blobToDownload(blob, 'geogebra-studio.ggb');
  }, [engine]);

  const handleClearDraft = useCallback(async () => {
    await store.clear();
    setLastResult({ success: true, command: 'Clear local draft', labels: [], timestamp: Date.now() });
  }, [store]);

  return <GeoGebraStudioShell engine={engine} ready={ready} error={error} loadingMessage={loadingMessage} settings={settings} capabilities={capabilities} events={events} graph={dependencyGraphState.graph} graphStatus={dependencyGraphState.status} graphError={dependencyGraphState.error} onRefreshGraph={dependencyGraphState.refresh} lastResult={lastResult} onReady={handleReady} onError={handleError} onSettingsChange={handleSettingsChange} onCommandResult={handleCommandResult} onImport={handleImport} onExport={handleExport} onClearDraft={handleClearDraft} onResetInitial={resetToInitial} />;
};

export default GeoGebraStudioPage;
