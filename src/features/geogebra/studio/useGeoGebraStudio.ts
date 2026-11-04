import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_STUDIO_SETTINGS, GEOGEBRA_AUTOSAVE_DELAY, MAX_SIDE_PANEL_WIDTH, MIN_SIDE_PANEL_WIDTH } from '../config';
import { GeoGebraEmbeddingAdapter } from '../adapters/GeoGebraEmbeddingAdapter';
import { IndexedDbProjectStore } from '../persistence/indexedDbProjectStore';
import { base64ToFile, blobToDownload } from '../persistence/ggbFileCodec';
import type { CommandResult, EngineCapabilities, GeoGebraEngine, GeometryEvent, StudioSettings } from '../types';
import { useDependencyGraph } from '../analysis/useDependencyGraph';
import { useGeometryRelations } from '../analysis/useGeometryRelations';
import { PreferenceController } from '../settings/PreferenceController';
import { InternalHelperLifecycle } from '../commands/custom/helperLifecycle';
import { isInternalHelperName } from '../commands/custom/internalHelpers';
import { readPreferences, savePreferences } from '../settings/preferenceStore';
import type { GgbPreferences, ObjectStyle } from '../settings/types';
import { newDocument, restoreWorkspace, uniqueTitle, type WorkspaceDocument, type WorkspaceSnapshot } from '../persistence/workspace';

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
    const parsed = JSON.parse(raw) as Partial<StudioSettings> & { allowNonGeometricHelpers?: boolean };
    const sidePanelWidth = typeof parsed.sidePanelWidth === 'number' && Number.isFinite(parsed.sidePanelWidth)
      ? Math.min(MAX_SIDE_PANEL_WIDTH, Math.max(MIN_SIDE_PANEL_WIDTH, parsed.sidePanelWidth))
      : DEFAULT_STUDIO_SETTINGS.sidePanelWidth;
    const helperMode = ['low', 'medium', 'high'].includes(parsed.helperMode ?? '')
      ? parsed.helperMode! : typeof parsed.allowNonGeometricHelpers === 'boolean'
        ? parsed.allowNonGeometricHelpers ? 'medium' : 'low'
        : DEFAULT_STUDIO_SETTINGS.helperMode;
    const { allowNonGeometricHelpers: _legacy, ...stored } = parsed;
    return { ...DEFAULT_STUDIO_SETTINGS, ...stored, sidePanelWidth, helperMode };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS };
  }
};

export function useGeoGebraStudio() {
  const [engine] = useState<GeoGebraEngine>(() => new GeoGebraEmbeddingAdapter());
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
  const workspaceRef = useRef<WorkspaceSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const busyRef = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveRef = useRef<Promise<void> | null>(null);
  const publishWorkspace = useCallback((next: WorkspaceSnapshot) => { workspaceRef.current = next; setWorkspace(next); }, []);
  const persistWorkspace = useCallback((next: WorkspaceSnapshot) => {
    const task = saveQueue.current.catch(() => undefined).then(() => store.saveWorkspace(next));
    saveQueue.current = task;
    return task;
  }, [store]);
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
    void Promise.all([store.getWorkspace(), store.getLatest()]).then(async ([saved, legacy]) => {
      if (operationId !== loadOperationRef.current) return;
      const next = restoreWorkspace(saved, legacy);
      const doc = next.documents.find((item) => item.id === next.activeId)!;
      await controller.loadDocument(async () => {
        if (doc.ggbBase64) await engine.importGgb(base64ToFile(doc.ggbBase64));
      }, doc.managedStyles);
      publishWorkspace(next);
      // Persist migration before any later automatic save can replace it.
      await persistWorkspace(next);
      dependencyGraphState.refresh();
    }).catch(async (error: unknown) => {
      if (!workspaceRef.current) await controller.loadDocument(async () => undefined).catch(() => undefined);
      setPreferenceError(error instanceof Error ? `Could not restore workspace: ${error.message}` : 'Could not restore workspace.');
      if (!workspaceRef.current) publishWorkspace(restoreWorkspace(null, null));
    }).finally(() => {
      if (operationId === loadOperationRef.current) setLoadingMessage(null);
    });
  }, [dependencyGraphState.refresh, engine, store, publishWorkspace, persistWorkspace]);

  const handleError = useCallback((loadError: Error) => {
    resettingRef.current = false;
    setError(loadError.message);
    setCapabilities(engine.getCapabilities());
  }, [engine]);

  const handleSettingsChange = useCallback((nextSettings: StudioSettings) => setSettings(nextSettings), []);

  const captureActive = useCallback(async (current: WorkspaceSnapshot): Promise<WorkspaceSnapshot> => {
    const managedStyles = await preferenceControllerRef.current?.snapshot();
    const ggbBase64 = await blobToBase64(await engine.exportGgb());
    return { ...current, documents: current.documents.map((doc) => doc.id === current.activeId ? { ...doc, ggbBase64, managedStyles } : doc) };
  }, [engine]);

  const saveDraft = useCallback(() => {
    if (!ready || loadingMessage || busyRef.current || autosaveRef.current || !workspaceRef.current) return;
    const task = (async () => {
      try {
        const next = await captureActive(workspaceRef.current!);
        await persistWorkspace(next);
        publishWorkspace(next);
        setHasUnsavedChanges(false);
      } catch {
        setPreferenceError('Could not save workspace in browser storage.');
      }
    })();
    autosaveRef.current = task;
    void task.finally(() => { autosaveRef.current = null; });
  }, [ready, loadingMessage, captureActive, persistWorkspace, publishWorkspace]);

  useEffect(() => {
    if (!ready || !workspace) return undefined;
    const timeout = window.setTimeout(() => void saveDraft(), GEOGEBRA_AUTOSAVE_DELAY);
    return () => window.clearTimeout(timeout);
  }, [events, lastResult, ready, saveDraft, workspace?.activeId]);

  // All document transitions serialize behind an in-flight autosave and capture
  // the current engine before replacing it. The overlay blocks canvas edits.
  const transition = useCallback(async (choose: (current: WorkspaceSnapshot) => { next: WorkspaceSnapshot; target?: WorkspaceDocument; file?: File }) => {
    if (!ready || !workspaceRef.current || busyRef.current || loadingMessage) return;
    busyRef.current = true;
    setDocumentBusy(true);
    setLoadingMessage('Switching construction…');
    const operationId = ++loadOperationRef.current;
    let captured: WorkspaceSnapshot | undefined;
    try {
      await autosaveRef.current;
      captured = await captureActive(workspaceRef.current!);
      await persistWorkspace(captured);
      const { next, target, file } = choose(captured);
      if (target || file) {
        const controller = preferenceControllerRef.current;
        const load = async () => {
          if (file) await engine.importGgb(file);
          else if (target?.ggbBase64) await engine.importGgb(base64ToFile(target.ggbBase64));
          else await engine.callApi('newConstruction', []);
        };
        if (controller) await controller.loadDocument(load, target?.managedStyles);
        else await load();
      }
      // Save the new active construction before committing its selection.
      const complete = target || file ? await captureActive(next) : next;
      await persistWorkspace(complete);
      publishWorkspace(complete);
      setHasUnsavedChanges(false);
      setLastResult(null);
      setEvents([]);
      dependencyGraphState.refresh();
    } catch (error) {
      if (captured) {
        const previous = captured.documents.find((doc) => doc.id === captured!.activeId)!;
        try { await preferenceControllerRef.current?.loadDocument(() => engine.importGgb(base64ToFile(previous.ggbBase64!)), previous.managedStyles); } catch { /* retain the saved copy */ }
        publishWorkspace(captured);
      }
      throw error;
    } finally {
      busyRef.current = false;
      setDocumentBusy(false);
      if (operationId === loadOperationRef.current) setLoadingMessage(null);
    }
  }, [ready, loadingMessage, captureActive, persistWorkspace, publishWorkspace, engine, dependencyGraphState.refresh]);

  const switchDocument = useCallback((id: string) => transition((current) => {
    const target = current.documents.find((doc) => doc.id === id);
    return target && id !== current.activeId ? { next: { ...current, activeId: id }, target } : { next: current };
  }), [transition]);
  const createDocument = useCallback(() => transition((current) => {
    const target = newDocument(uniqueTitle(current.documents, 'Untitled'));
    return { next: { ...current, activeId: target.id, documents: [...current.documents, target] }, target };
  }), [transition]);
  const closeDocument = useCallback((id: string) => transition((current) => {
    const index = current.documents.findIndex((doc) => doc.id === id);
    if (index < 0) return { next: current };
    const documents = current.documents.filter((doc) => doc.id !== id);
    if (!documents.length) documents.push(newDocument());
    const target = id === current.activeId ? documents[Math.min(index, documents.length - 1)] : undefined;
    return { next: { ...current, documents, activeId: target?.id ?? current.activeId }, target };
  }), [transition]);

  const handleCommandResult = useCallback((result: CommandResult) => {
    setLastResult(result);
    if (result.success) setHasUnsavedChanges(true);
  }, []);

  const handleImport = useCallback((file: File) => transition((current) => {
    const target = newDocument(uniqueTitle(current.documents, file.name.replace(/\.ggb$/i, '') || file.name));
    return { next: { ...current, activeId: target.id, documents: [...current.documents, target] }, target, file };
  }), [transition]);

  const handleExport = useCallback(async () => {
    const blob = await engine.exportGgb();
    const title = workspaceRef.current?.documents.find((doc) => doc.id === workspaceRef.current?.activeId)?.title ?? 'geogebra-studio';
    blobToDownload(blob, `${title.replace(/[\\/:*?"<>|]/g, '_')}.ggb`);
  }, [engine]);

  const handleClearDraft = useCallback(async () => {
    if (!window.confirm('Remove all saved workspace tabs from this browser? The current canvas stays open until you leave.')) return;
    await autosaveRef.current;
    await saveQueue.current.catch(() => undefined);
    await store.clearWorkspace();
    setPreferenceError('Browser workspace backup cleared. Further changes will save it again.');
  }, [store]);

  const resetToInitial = useCallback(async () => {
    if (!window.confirm('Reset this construction? Its current contents will be discarded.')) return;
    await transition((current) => {
      const target = { ...newDocument(), id: current.activeId };
      return { next: { ...current, documents: current.documents.map((doc) => doc.id === current.activeId ? target : doc) }, target };
    });
  }, [transition]);

  return {
    onEditObjectStyle: handleEditObjectStyle,
    preferences,
    preferenceError,
    onPreferencesChange: handlePreferencesChange,
    onApplyPreferences: () => preferenceControllerRef.current?.applyToAll() ?? Promise.resolve(),
    engine, ready, error, loadingMessage, settings, capabilities, events,
    workspace, documentBusy, onSwitchDocument: switchDocument, onNewDocument: createDocument, onCloseDocument: closeDocument,
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
