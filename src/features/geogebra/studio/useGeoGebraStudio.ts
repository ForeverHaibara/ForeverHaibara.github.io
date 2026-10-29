import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STUDIO_SETTINGS, GEOGEBRA_AUTOSAVE_DELAY, GEOGEBRA_LATEST_PROJECT_ID, MAX_SIDE_PANEL_WIDTH, MIN_SIDE_PANEL_WIDTH } from '../config';
import { GeoGebraEmbeddingAdapter } from '../adapters/GeoGebraEmbeddingAdapter';
import { IndexedDbProjectStore } from '../persistence/indexedDbProjectStore';
import { base64ToFile, blobToDownload } from '../persistence/ggbFileCodec';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, GeometryProjectRecord, StudioSettings } from '../types';
import { useDependencyGraph } from '../analysis/useDependencyGraph';
import { useGeometryRelations } from '../analysis/useGeometryRelations';
import { PreferenceController } from '../settings/PreferenceController';
import { InternalHelperLifecycle } from '../commands/custom/helperLifecycle';
import { isInternalHelperName } from '../commands/custom/internalHelpers';
import { readPreferences, savePreferences } from '../settings/preferenceStore';
import type { GgbPreferences, ObjectStyle } from '../settings/types';

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
    if (!raw) return { ...DEFAULT_STUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    const sidePanelWidth = typeof parsed.sidePanelWidth === 'number' && Number.isFinite(parsed.sidePanelWidth)
      ? Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, parsed.sidePanelWidth))
      : DEFAULT_STUDIO_SETTINGS.sidePanelWidth;
    return { ...DEFAULT_STUDIO_SETTINGS, ...parsed, sidePanelWidth,
      allowNonGeometricHelpers: parsed.allowNonGeometricHelpers === true };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
};

export function useGeoGebraStudio() {
  const [engine, setEngine] = useState<GeoGebraEngine>(() => new GeoGebraEmbeddingAdapter());
  const store = useMemo(() => new IndexedDbProjectStore(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(readSettings);
  const [preferences, setPreferences] = useState(readPreferences);
  const preferencesRef = useRef(preferences);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const preferenceControllerRef = useRef<PreferenceController | null>(null);
  const [capabilities, setCapabilities] = useState<EngineCapabilities>(engine.getCapabilities());
  const [events, setEvents] = useState<GeometryEvent[]>([]);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const restoredRef = useRef(false);
  const loadOperationRef = useRef(0);
  const resettingRef = useRef(false);
  const dependencyGraphState = useDependencyGraph(engine, ready);
  const geometryRelations = useGeometryRelations(dependencyGraphState.graph, dependencyGraphState.status);

  useEffect(() => () => {
    preferenceControllerRef.current?.dispose();
    preferenceControllerRef.current = null;
    restoredRef.current = false;
    loadOperationRef.current += 1;
  }, []);

  const handlePreferencesChange = useCallback((next: GgbPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    setPreferenceError(savePreferences(next) ? null : 'Browser storage is unavailable; changes last for this session.');
    void preferenceControllerRef.current?.update(next);
  }, []);

  const handleEditObjectStyle = useCallback(async (names: readonly string[], patch: ObjectStyle | null) => {
    await preferenceControllerRef.current?.editObjects(names, patch);
    setHasUnsavedChanges(true);
    // Also schedules autosave on engines without updateStyle notifications.
    setEvents((current) => [...current, { type: 'style' as const, timestamp: Date.now() }].slice(-100));
  }, []);

  useEffect(() => {
    let helperRemovalTimer: number | undefined;
    const unsubscribe = engine.subscribe((event) => {
      // Output events still trigger refresh and autosave; per-helper add/update
      // bursts need not render React or restart the save timer dozens of times.
      if (event.objectName && isInternalHelperName(event.objectName)) {
        if (event.type === 'remove') {
          window.clearTimeout(helperRemovalTimer);
          helperRemovalTimer = window.setTimeout(() => setEvents((current) => [...current, event].slice(-100)), 100);
        }
        return;
      }
      setEvents((current) => [...current, event].slice(-100));
    });
    return () => { unsubscribe(); window.clearTimeout(helperRemovalTimer); };
  }, [engine]);

  useEffect(() => {
    if (!ready) return undefined;
    const lifecycle = new InternalHelperLifecycle(engine);
    return () => lifecycle.dispose();
  }, [engine, ready]);

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
    preferenceControllerRef.current?.dispose();
    preferenceControllerRef.current = null;

    // reset() restores the applet's loaded file. A new embedding also removes
    // imported macros and returns to a genuinely empty document.
    engine.dispose();
    await store.clear().catch(() => undefined);
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
    const controller = new PreferenceController(engine, preferencesRef.current, setPreferenceError);
    preferenceControllerRef.current = controller;
    if (resettingRef.current) {
      resettingRef.current = false;
      void controller.loadDocument(async () => undefined);
      return;
    }
    const operationId = ++loadOperationRef.current;
    setLoadingMessage('Restoring your last GeoGebra draft...');
    void store.getLatest().then(async (project) => {
      if (operationId !== loadOperationRef.current) return;
      await controller.loadDocument(async () => {
        if (project?.ggbBase64) await engine.importGgb(base64ToFile(project.ggbBase64));
      }, project?.managedStyles);
      dependencyGraphState.refresh();
    }).catch(() => controller.loadDocument(async () => undefined)).finally(() => {
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
    if (!ready || loadingMessage || resettingRef.current) return;
    const operationId = loadOperationRef.current;
    try {
      const managedStyles = await preferenceControllerRef.current?.snapshot();
      const blob = await engine.exportGgb();
      const record: GeometryProjectRecord = {
        id: GEOGEBRA_LATEST_PROJECT_ID,
        title: 'GeoGebra Studio Draft',
        ggbBase64: await blobToBase64(blob),
        settings,
        updatedAt: Date.now(),
        managedStyles,
      };
      if (operationId !== loadOperationRef.current) return;
      await store.save(record);
      setHasUnsavedChanges(false);
    } catch {
      // Some browser privacy modes disable IndexedDB; no user action should be blocked.
    }
  }, [engine, ready, settings, preferences, store, loadingMessage]);

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
      const controller = preferenceControllerRef.current;
      if (controller) await controller.loadDocument(() => engine.importGgb(file));
      else await engine.importGgb(file);
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

  return {
    onEditObjectStyle: handleEditObjectStyle,
    preferences,
    preferenceError,
    onPreferencesChange: handlePreferencesChange,
    onApplyPreferences: () => preferenceControllerRef.current?.applyToAll() ?? Promise.resolve(),
    engine, ready, error, loadingMessage, settings, capabilities, events,
    graph: dependencyGraphState.graph,
    graphStatus: dependencyGraphState.status,
    graphError: dependencyGraphState.error,
    geometryRelations,
    onRefreshGraph: dependencyGraphState.refresh,
    lastResult,
    onReady: handleReady,
    onError: handleError,
    onSettingsChange: handleSettingsChange,
    onCommandResult: handleCommandResult,
    onImport: handleImport,
    onExport: handleExport,
    onClearDraft: handleClearDraft,
    onResetInitial: resetToInitial,
  };
}
